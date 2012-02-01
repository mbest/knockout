ko.proxyObservable = function(evaluatorFunction) {
    function proxyObservable() {
        return evaluatorFunction();
    }

    proxyObservable.__ko_proto__ = ko.proxyObservable;

    return proxyObservable;
};

ko.proxyObservable.__ko_proto__ = ko.observable;

ko.utils.unwrapProxyObservable = function (value) {
    return (value && value.__ko_proto__ && value.__ko_proto__ === ko.proxyObservable) ? value() : value;
};
