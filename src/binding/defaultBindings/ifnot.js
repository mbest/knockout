// "ifnot: someExpression" is equivalent to "template: { ifnot: someExpression }"
ko.bindingHandlers['ifnot'] = templateBasedBinding( function(value, options) { options['ifnot'] = value; });
