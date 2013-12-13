ko.extenders = {
    'throttle': function(target, timeout) {
        if (!target['limit'])
            return;

        target['limit'](function (callback) {
            var timeoutInstance;
            return function () {
                if (!timeoutInstance) {
                    timeoutInstance = setTimeout(function() {
                        timeoutInstance = undefined;
                        callback();
                    }, timeout);
                }
            };
        });
    },

    'debounce': function(target, timeout) {
        if (!target['limit'])
            return;

        target['limit'](function (callback) {
            var timeoutInstance;
            return function () {
                clearTimeout(timeoutInstance);
                timeoutInstance = setTimeout(callback, timeout);
            };
        });
    },

    'notify': function(target, notifyWhen) {
        target["equalityComparer"] = notifyWhen == "always" ?
            null :  // null equalityComparer means to always notify
            valuesArePrimitiveAndEqual;
    }
};

var primitiveTypes = { 'undefined':1, 'boolean':1, 'number':1, 'string':1 };
function valuesArePrimitiveAndEqual(a, b) {
    var oldValueIsPrimitive = (a === null) || (typeof(a) in primitiveTypes);
    return oldValueIsPrimitive ? (a === b) : false;
}

function applyExtenders(requestedExtenders) {
    var target = this;
    if (requestedExtenders) {
        ko.utils.objectForEach(requestedExtenders, function(key, value) {
            var extenderHandler = ko.extenders[key];
            if (typeof extenderHandler == 'function') {
                target = extenderHandler(target, value) || target;
            }
        });
    }
    return target;
}

ko.exportSymbol('extenders', ko.extenders);
