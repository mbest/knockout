// "if: someExpression" is equivalent to "template: { if: someExpression }"
ko.bindingHandlers['if'] = templateBasedBinding( function(value, options) { options['if'] = value; });
