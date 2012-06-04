
ko.bindingExpressionRewriting = (function () {
    var javaScriptAssignmentTarget = /^[\_$a-z][\_$a-z0-9]*(\[.*?\])*(\.[\_$a-z][\_$a-z0-9]*(\[.*?\])*)*$/i;
    var javaScriptReservedWords = ["true", "false", "null"];

    function isWriteableValue(expression) {
        if (ko.utils.arrayIndexOf(javaScriptReservedWords, expression) >= 0)
            return false;
        return expression.match(javaScriptAssignmentTarget) !== null;
    }

    function isFunctionLiteral(expression) {
        // match function literal, which must start with function end with }
        return expression.match(/^[\(\s]*function\s*\(.*}[\)\s]*$/) !== null;
    }

    function isPossiblyUnwrappedObservable(expression) {
        // match parentheses in the expression, but ignore initial parentheses
        return expression.match(/[^(]+\(/) !== null;
    }

    function ensureQuoted(key) {
        return "'" + key + "'";
    }

    var stringDouble = '(?:"(?:[^"\\\\]|\\\\.)*")';
    var stringSingle = "(?:'(?:[^'\\\\]|\\\\.)*')";
    var stringRegexp = '(?:/(?:[^/\\\\]|\\\\.)*/)';
    var specials = ',"\'{}()/:[\\]';
    var everyThingElse = '(?:[^\\s:,][^' + specials + ']*[^\\s' + specials + '])';
    var oneNotSpace = '[^\\s]';

    var bindingToken = RegExp(
        '(?:' + stringDouble
        + '|' + stringSingle
        + '|' + stringRegexp
        + '|' + everyThingElse
        + '|' + oneNotSpace
        + ')', 'g');

    function parseObjectLiteral(objectLiteralString) {
        // A full tokeniser+lexer would add too much weight to this library, so here's a simple parser
        // that is sufficient just to split an object literal string into a set of top-level key-value pairs
        var str = ko.utils.stringTrim(objectLiteralString);
        if (str.charCodeAt(0) === 123) // '{' Ignore braces surrounding the whole object literal
            str = str.slice(1, -1);

        // Split into tokens
        var result = [],
            toks = str.match(bindingToken),
            key, values, depth = 0;

        if (toks) {
            // append a comma so that the last item gets added to result
            toks.push(',');

            for (var i = 0, n = toks.length; i < n; ++i) {
                var tok = toks[i], c = tok.charCodeAt(0);
                if (c === 44) { // ","
                    if (depth <= 0) {
                        if (key)
                            result.push([key, values ? values.join('') : undefined]);
                        key = values = depth = 0;
                        continue;
                    }
                } else if (c === 58) { // ":"
                    if (!values)
                        continue;
                } else if (c === 40 || c === 123 || c === 91) { // '(', '{', '['
                    ++depth;
                } else if (c === 41 || c === 125 || c === 93) { // ')', '}', ']'
                    --depth;
                } else if (!key) {
                    key = (c === 34 || c === 39) // '"', "'"
                        ? tok.slice(1, -1)
                        : tok;
                    continue;
                }
                if (values)
                    values.push(tok);
                else
                    values = [tok];
            }
        }
        return result;
    }

    return {
        parseObjectLiteral: parseObjectLiteral,

        preProcessBindings: function (bindingsStringOrKeyValueArray, bindingOptions) {
            bindingOptions = bindingOptions || {};
            var resultStrings = [], propertyAccessorResultStrings = [],
                eventHandlersUseObjectForThis = bindingOptions['eventHandlersUseObjectForThis'],
                independentBindings = bindingOptions['independentBindings'];
            independentBindings = independentBindings === false ? false : true;

            function processKeyValue(key, val, parentBinding) {
                var quotedKey = ensureQuoted(key),
                    binding = parentBinding || ko.getBindingHandler(key),
                    canWrap = binding || independentBindings,
                    flags = binding && binding['flags'];

                if (val === undefined && flags & bindingFlags_noValue) {
                    // If the binding can used without a value set its value to 'true'
                    val = "true";
                }
                if (!parentBinding && flags & bindingFlags_twoLevel && val.charAt(0) === "{") {
                    // Handle two-level binding specified as "binding: {key: value}" by parsing inner
                    // object and converting to "binding.key: value"
                    var subBindings = parseObjectLiteral(val);
                    ko.utils.arrayForEach(subBindings, function(keyValue) {
                        processKeyValue(key+'.'+keyValue[0], keyValue[1], binding);
                    });
                    return;
                }
                if (binding && binding['preprocess']) {
                    val = binding['preprocess'](val, key, processKeyValue);
                    if (!val)
                        return;
                }
                if (!isFunctionLiteral(val)) {
                    if (binding && isWriteableValue(val)) {
                        if (eventHandlersUseObjectForThis && flags & bindingFlags_eventHandler) {
                            // call function literal in an anonymous function so that it is called
                            // with appropriate "this" value
                            val = 'function(_x,_y,_z){(' + val + ')(_x,_y,_z);}';
                            canWrap = false;
                        }
                        else if (flags & bindingFlags_twoWay) {
                            // for two-way bindings, provide a write method in case the value
                            // isn't a writable observable
                            propertyAccessorResultStrings.push(quotedKey + ":function(_z){" + val + "=_z;}");
                        }
                    }
                    if (canWrap && isPossiblyUnwrappedObservable(val)) {
                        // Try to prevent observables from being accessed when parsing a binding;
                        // Instead they will be "unwrapped" within the context of the specific binding handler
                        val = 'ko.bindingValueWrap(function(){return ' + val + '})';
                    }
                }
                resultStrings.push(quotedKey + ":" + val);
            }

            var keyValueArray = typeof bindingsStringOrKeyValueArray === "string"
                ? parseObjectLiteral(bindingsStringOrKeyValueArray)
                : bindingsStringOrKeyValueArray;

            ko.utils.arrayForEach(keyValueArray, function(keyValue) {
                processKeyValue(keyValue[0], keyValue[1]);
            });

            var combinedResult = resultStrings.join(",");
            if (propertyAccessorResultStrings.length > 0) {
                var allPropertyAccessors = propertyAccessorResultStrings.join(",");
                combinedResult = combinedResult + ",'_ko_property_writers':{" + allPropertyAccessors + "}";
            }

            return combinedResult;
        },

        keyValueArrayContainsKey: function(keyValueArray, key) {
            for (var i = 0; i < keyValueArray.length; i++)
                if (keyValueArray[i][0] == key)
                    return true;
            return false;
        },

        // Internal, private KO utility for updating model properties from within bindings
        // property:            If the property being updated is (or might be) an observable, pass it here
        //                      If it turns out to be a writable observable, it will be written to directly
        // allBindingsAccessor: All bindings in the current execution context.
        //                      This will be searched for a '_ko_property_writers' property in case you're writing to a non-observable
        // key:                 The key identifying the property to be written. Example: for { hasFocus: myValue }, write to 'myValue' by specifying the key 'hasFocus'
        // value:               The value to be written
        // checkIfDifferent:    If true, and if the property being written is a writable observable, the value will only be written if
        //                      it is !== existing value on that writable observable
        writeValueToProperty: function(property, allBindingsAccessor, key, value, checkIfDifferent) {
            if (!property || !ko.isWriteableObservable(property)) {
                var propWriters = allBindingsAccessor('_ko_property_writers');
                if (propWriters && propWriters[key])
                    propWriters[key](value);
            } else if (!checkIfDifferent || property() !== value) {
                property(value);
            }
        }
    };
})();
