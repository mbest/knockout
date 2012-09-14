// For certain common events (currently just 'click'), allow a simplified data-binding syntax
// e.g. click:handler instead of the usual full-length event:{click:handler}
ko.bindingHandlers['click'] = makeKeySubkeyBinding('event' + keySubkeyBindingDivider + 'click');
