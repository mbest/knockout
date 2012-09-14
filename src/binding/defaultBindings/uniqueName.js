ko.bindingHandlers['uniqueName'] = {
    'flags': bindingFlags_noValue,
    'init': function (element, valueAccessor) {
        if (valueAccessor()) {
            ko.domObservable(element, 'name')("ko_unique_" + (++ko.bindingHandlers['uniqueName'].currentIndex));
        }
    }
};
ko.bindingHandlers['uniqueName'].currentIndex = 0;
