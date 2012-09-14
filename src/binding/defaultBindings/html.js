ko.bindingHandlers['html'] = {
    'flags': bindingFlags_contentBind | bindingFlags_contentSet,
    'update': function (element, valueAccessor) {
        // setHtml will unwrap the value if needed
        ko.utils.setHtml(element, valueAccessor());
    }
};
