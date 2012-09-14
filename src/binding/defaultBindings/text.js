ko.bindingHandlers['text'] = {
    'flags': bindingFlags_contentBind | bindingFlags_contentSet | bindingFlags_canUseVirtual,
    'init': function(element) {
        ko.virtualElements.setDomNodeChildren(element, [document.createTextNode("")]);
    },
    'update': function (element, valueAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor());
        ko.virtualElements.firstChild(element).data = (value == null) ? "" : value;

        // Workaround for an IE9 rendering bug - https://github.com/SteveSanderson/knockout/issues/209
        if (ko.utils.ieVersion >= 9) {
            // For text nodes and comment nodes (most likely virtual elements), we will have to refresh the container
            var node = element.nodeType == 1 ? element : element.parentNode;
            if (node.style)
                node.style.zoom = node.style.zoom;
        }
    }
};
