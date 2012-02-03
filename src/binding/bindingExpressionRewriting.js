
ko.bindingExpressionRewriting = (function () {
    var restoreCapturedTokensRegex = /\@ko_token_(\d+)\@/g;
    var javaScriptAssignmentTarget = /^[\_$a-z][\_$a-z0-9]*(\[.*?\])*(\.[\_$a-z][\_$a-z0-9]*(\[.*?\])*)*$/i;
    var javaScriptReservedWords = ["true", "false", "null"];

    function restoreTokens(string, tokens) {
        var prevValue = null;
        while (string != prevValue) { // Keep restoring tokens until it no longer makes a difference (they may be nested)
            prevValue = string;
            string = string.replace(restoreCapturedTokensRegex, function (match, tokenIndex) {
                return tokens[tokenIndex];
            });
        }
        return ko.utils.stringTrim(string);
    }

    function isWriteableValue(expression) {
        if (ko.utils.arrayIndexOf(javaScriptReservedWords, expression.toLowerCase()) >= 0)
            return false;
        return expression.match(javaScriptAssignmentTarget) !== null;
    }

    function isPossiblyUnwrappedObservable(expression) {
        return expression.indexOf("(") != -1;
    }

    function stripQuotes(key) {
        switch (key.length && key.charAt(0)) {
            case "'":
            case '"':
                return key.substring(1, key.length - 1);
            default:
                return key;
        }

    }

    function ensureQuoted(key) {
        return "'" + key + "'";
    }

    return {
        parseObjectLiteral: function(objectLiteralString) {
            // A full tokeniser+lexer would add too much weight to this library, so here's a simple parser
            // that is sufficient just to split an object literal string into a set of top-level key-value pairs

            var str = ko.utils.stringTrim(objectLiteralString);
            if (str.length < 3)
                return [];
            if (str.charAt(0) === "{")// Ignore any braces surrounding the whole object literal
                str = str.substring(1, str.length - 1);

            // Pull out any string literals and regex literals
            var tokens = [];
            var tokenStart = null, tokenEndChar;
            for (var position = 0; position < str.length; position++) {
                var c = str.charAt(position);
                if (tokenStart === null) {
                    switch (c) {
                        case '"':
                        case "'":
                        case "/":
                            tokenStart = position;
                            tokenEndChar = c;
                            break;
                    }
                } else if ((c == tokenEndChar) && (str.charAt(position - 1) !== "\\")) {
                    var token = str.substring(tokenStart, position + 1);
                    tokens.push(token);
                    var replacement = "@ko_token_" + (tokens.length - 1) + "@";
                    str = str.substring(0, tokenStart) + replacement + str.substring(position + 1);
                    position -= (token.length - replacement.length);
                    tokenStart = null;
                }
            }

            // Next pull out balanced paren, brace, and bracket blocks
            tokenStart = null;
            tokenEndChar = null;
            var tokenDepth = 0, tokenStartChar = null;
            for (var position = 0; position < str.length; position++) {
                var c = str.charAt(position);
                if (tokenStart === null) {
                    switch (c) {
                        case "{": tokenStart = position; tokenStartChar = c;
                                  tokenEndChar = "}";
                                  break;
                        case "(": tokenStart = position; tokenStartChar = c;
                                  tokenEndChar = ")";
                                  break;
                        case "[": tokenStart = position; tokenStartChar = c;
                                  tokenEndChar = "]";
                                  break;
                    }
                }

                if (c === tokenStartChar)
                    tokenDepth++;
                else if (c === tokenEndChar) {
                    tokenDepth--;
                    if (tokenDepth === 0) {
                        var token = str.substring(tokenStart, position + 1);
                        tokens.push(token);
                        var replacement = "@ko_token_" + (tokens.length - 1) + "@";
                        str = str.substring(0, tokenStart) + replacement + str.substring(position + 1);
                        position -= (token.length - replacement.length);
                        tokenStart = null;
                    }
                }
            }

            // Now we can safely split on commas to get the key/value pairs
            var result = [];
            var keyValuePairs = str.split(",");
            for (var i = 0, j = keyValuePairs.length; i < j; i++) {
                var pair = keyValuePairs[i];
                var colonPos = pair.indexOf(":");
                if ((colonPos > 0) && (colonPos < pair.length - 1)) {
                    var key = pair.substring(0, colonPos);
                    var value = pair.substring(colonPos + 1);
                    result.push({ 'key': stripQuotes(restoreTokens(key, tokens)), 'value': restoreTokens(value, tokens) });
                } else {
                    result.push({ 'unknown': stripQuotes(restoreTokens(pair, tokens)) });
                }
            }
            return result;
        },

        insertPropertyAccessors: function (objectLiteralStringOrKeyValueArray) {
            var resultStrings = [], propertyAccessorResultStrings = [];

            function insertPropertyAccessorsHelper(objectLiteralStringOrKeyValueArray, parentBinding, parentBindingKey) {
                var keyValueArray = typeof objectLiteralStringOrKeyValueArray === "string"
                    ? ko.bindingExpressionRewriting.parseObjectLiteral(objectLiteralStringOrKeyValueArray)
                    : objectLiteralStringOrKeyValueArray;
                var keyValueEntry;
                for (var i = 0; keyValueEntry = keyValueArray[i]; i++) {
                    if (resultStrings.length > 0)
                        resultStrings.push(",");

                    if (keyValueEntry['key']) {
                        var key = keyValueEntry['key'], val = keyValueEntry['value'],
                            quotedKey = ensureQuoted(parentBindingKey ? parentBindingKey+'.'+key : key),
                            binding = parentBinding || ko.getBindingHandler(key);
                        if (!parentBinding && binding && (binding['flags'] & bindingFlags_twoLevel) && val.charAt(0) === "{") {
                            // Handle two-level binding specified as "binding: {key: value}" by parsing inner
                            // object and converting to "binding.key: value"
                            insertPropertyAccessorsHelper(val, binding, key);
                        } else {
                            if (binding) {
                                if (isWriteableValue(val)) {
                                    if (binding['flags'] & bindingFlags_eventHandler) {
                                        // call function literal in an anonymous function so that it is called
                                        // with appropriate "this" value
                                        val = 'function(_x,_y,_z){(' + val + ')(_x,_y,_z);}';
                                    }
                                    else if (binding['flags'] & bindingFlags_twoWay) {
                                        // for two-way bindings, provide a write method in case the value
                                        // isn't a writable observable
                                        if (propertyAccessorResultStrings.length > 0)
                                            propertyAccessorResultStrings.push(",");
                                        propertyAccessorResultStrings.push(quotedKey + ":function(_z){" + val + "=_z;}");
                                    }
                                }
                                else if (!(binding['flags'] & bindingFlags_eventHandler) && isPossiblyUnwrappedObservable(val)) {
                                    // Try to prevent observables from being accessed when parsing a binding;
                                    // Instead they will be "unwrapped" within the context of the specific binding handler
                                    val = 'ko.bindingValueWrap(function(){return ' + val + '})';
                                }
                            }
                            resultStrings.push(quotedKey + ":" + val);
                        }
                    } else if (keyValueEntry['unknown']) {
                        // Check if the 'unknown' entry matches a binding handler that can used without a value
                        // and include it with a value of 'true'
                        var key = keyValueEntry['unknown'], binding = ko.bindingHandlers[key];
                        if (binding && (binding['flags'] & bindingFlags_noValue))
                            resultStrings.push(ensureQuoted(key)+ ":true");
                        else
                            resultStrings.push(key);
                    }
                }
            }
            insertPropertyAccessorsHelper(objectLiteralStringOrKeyValueArray);

            var combinedResult = resultStrings.join("");
            if (propertyAccessorResultStrings.length > 0) {
                var allPropertyAccessors = propertyAccessorResultStrings.join("");
                combinedResult = combinedResult + ",'_ko_property_writers':{" + allPropertyAccessors + "}";
            }

            return combinedResult;
        },

        keyValueArrayContainsKey: function(keyValueArray, key) {
            for (var i = 0; i < keyValueArray.length; i++)
                if (keyValueArray[i]['key'] == key)
                    return true;
            return false;
        },

        writeValueToProperty: function(allBindingsAccessor, key, value) {
            var propWriters = allBindingsAccessor()['_ko_property_writers'];
            if (propWriters && propWriters[key])
                propWriters[key](value);
        }
    };
})();
