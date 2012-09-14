// Support a short-hand syntax of "key.subkey: value". The "key.subkey" binding
// handler will be created as needed (through ko.getBindingHandler) but can also be
// created initially (as event.click is).
var keySubkeyMatch = /([^\.]+)\.(.+)/, keySubkeyBindingDivider = '.';
function makeKeySubkeyBinding(bindingKey) {
    var match = bindingKey.match(keySubkeyMatch);
    if (match) {
        var baseKey = match[1],
            baseHandler = ko.bindingHandlers[baseKey];
        if (baseHandler) {
            var subKey = match[2],
                makeSubHandler = baseHandler['makeSubkeyHandler'] || makeDefaultKeySubkeyHandler,
                subHandler = makeSubHandler.call(baseHandler, baseKey, subKey, bindingKey);
            ko.virtualElements.allowedBindings[bindingKey] = ko.virtualElements.allowedBindings[baseKey];
            return (ko.bindingHandlers[bindingKey] = subHandler);
        }
    }
}

// Create a binding handler that translates a binding of "binding: value" to
// "basekey: {subkey: value}". Compatible with these default bindings: event, attr, css, style.
function makeDefaultKeySubkeyHandler(baseKey, subKey) {
    var subHandler = ko.utils.extendInternal({}, this);
    subHandler['flags'] ^= bindingFlags_twoLevel;   // remove two-level flag if it exists
    function setHandlerFunction(funcName) {
        if (subHandler[funcName]) {
            subHandler[funcName] = function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
                function subValueAccessor() {
                    var result = {};
                    result[subKey] = valueAccessor();
                    return result;
                }
                return ko.bindingHandlers[baseKey][funcName](element, subValueAccessor, allBindingsAccessor, viewModel, bindingContext);
            };
        }
    }
    ko.utils.arrayForEach(['init', 'update'], setHandlerFunction);
    return subHandler;
}

function setUpTwoWayBinding(element, modelValue, elemUpdater, elemValue, modelUpdater) {
    var isUpdating = false,
        shouldSet = false;

    function updateOnChange(source, callback) {
        ko.utils.possiblyWrap(function() {
            var value = ko.utils.unwrapObservable(source());
            if (shouldSet && !isUpdating) {
                isUpdating = true;
                ko.ignoreDependencies(callback, null, [value]);
                isUpdating = false;
            }
        }, element);
    };

    // Update model from view when changed (but not updated initially)
    updateOnChange(elemValue, modelUpdater);

    // Update view from model initially and when changed
    shouldSet = true;
    updateOnChange(modelValue, elemUpdater);
}

function preprocessAs(val, key, addBinding) {
    var match = val.match(/^([\s\S]+)\s+as\s+([$\w]+)\s*$/);
    if (match)
        addBinding('as', '"' + match[2] + '"');
    return match ? match[1] : val;
};

function templateBasedBinding(makeOptionsFunction, preprocess) {
    function makeTemplateValueAccessor(valueAccessor, allBindingsAccessor) {
        return function() {
            var options = {'templateEngine': ko.nativeTemplateEngine.instance};
            makeOptionsFunction(valueAccessor(), options, allBindingsAccessor);
            return options;
        };
    }
    return {
        'flags': bindingFlags_contentBind | bindingFlags_canUseVirtual,
        'preprocess': preprocess,
        'init': function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            return ko.bindingHandlers['template']['init'](element, makeTemplateValueAccessor(valueAccessor, allBindingsAccessor));
        },
        'update': function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            return ko.bindingHandlers['template']['update'](element, makeTemplateValueAccessor(valueAccessor, allBindingsAccessor), allBindingsAccessor, viewModel, bindingContext);
        }
    };
}
