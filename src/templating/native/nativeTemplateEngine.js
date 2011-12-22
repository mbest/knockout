ko.nativeTemplateEngine = function () {
    this['allowTemplateRewriting'] = false;
    this.templateSourceCache = {};
}

var anonymousTemplatesCacheDomDataKey = "__ko_anon_template_cache__";

ko.nativeTemplateEngine.prototype = new ko.templateEngine();
ko.nativeTemplateEngine.prototype['makeTemplateSource'] = function(template) {
    var source;
    if (typeof template == "string") {
        // Named template
        if (template in this.templateSourceCache)
            source = this.templateSourceCache[template];
        else {
            source = ko.templateEngine.prototype['makeTemplateSource'](template);
            this.templateSourceCache[template] = source;
        }
    } else if ((template.nodeType == 1) || (template.nodeType == 8)) {
        // Anonymous template
        source = ko.utils.domData.get(template, anonymousTemplatesCacheDomDataKey);
        if (source === undefined) {
            source = ko.templateEngine.prototype['makeTemplateSource'](template);
            ko.utils.domData.set(template, anonymousTemplatesCacheDomDataKey, source);
        }
    } else
        throw new Error("Unknown template type: " + template);
    return source; 
};
ko.nativeTemplateEngine.prototype['renderTemplateSource'] = function (templateSource, bindingContext, options) {
    var newNodes;
    if (templateSource.cachedNodes === undefined) {
        var templateText = templateSource.text();
        newNodes = templateSource.cachedNodes = ko.utils.parseHtmlFragment(templateText);
    } else {
        newNodes = ko.utils.arrayMap(templateSource.cachedNodes, function(oldNode) {
            var newNode = oldNode.cloneNode(true);
            ko.utils.domData.clean(newNode);
            var oldSource = ko.utils.domData.get(oldNode, anonymousTemplatesCacheDomDataKey);
            if (oldSource) {
                var newSource = ko.templateEngine.prototype['makeTemplateSource'](newNode);
                newSource.cachedNodes = oldSource.cachedNodes;
                ko.utils.domData.set(newNode, anonymousTemplatesCacheDomDataKey, newSource);
            }
            return newNode;
        });
    }
    return newNodes;
};

ko.nativeTemplateEngine.instance = new ko.nativeTemplateEngine();
ko.setTemplateEngine(ko.nativeTemplateEngine.instance);

ko.exportSymbol('ko.nativeTemplateEngine', ko.nativeTemplateEngine);