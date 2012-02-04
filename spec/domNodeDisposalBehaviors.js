
describe('DOM node disposal', {
    before_each: function () {
        testNode = document.createElement("div");
    },
        
    'Should run registered disposal callbacks when a node is cleaned': function () {
        var didRun = false;
        ko.utils.domNodeDisposal.addDisposeCallback(testNode, function() { didRun = true });
        
        value_of(didRun).should_be(false);
        ko.cleanNode(testNode);
        value_of(didRun).should_be(true);
    },
    
    'Should run registered disposal callbacks on descendants when a node is cleaned': function () {
        var didRun = false;
        var childNode = document.createElement("DIV");
        var grandChildNode = document.createElement("DIV");
        testNode.appendChild(childNode);
        childNode.appendChild(grandChildNode);
        ko.utils.domNodeDisposal.addDisposeCallback(grandChildNode, function() { didRun = true });
        
        value_of(didRun).should_be(false);
        ko.cleanNode(testNode);
        value_of(didRun).should_be(true);
    },    
    
    'Should run registered disposal callbacks and detach from DOM when a node is removed': function () {
        var didRun = false;
        var childNode = document.createElement("DIV");
        testNode.appendChild(childNode);
        ko.utils.domNodeDisposal.addDisposeCallback(childNode, function() { didRun = true });
        
        value_of(didRun).should_be(false);
        value_of(testNode.childNodes.length).should_be(1);
        ko.cleanAndRemoveNode(childNode);
        value_of(didRun).should_be(true);
        value_of(testNode.childNodes.length).should_be(0);
    },
    
    'Should be able to remove previously-registered disposal callbacks': function() {
        var didRun1 = false, didRun2 = false;
        var callback1 = function() { didRun1 = true }, callback2 = function() { didRun2 = true };
        var disposer1 = ko.utils.domNodeDisposal.addDisposeCallback(testNode, callback1);
        var disposer2 = ko.utils.domNodeDisposal.addDisposeCallback(testNode, callback2);

        value_of(didRun1).should_be(false);
        value_of(didRun2).should_be(false);
        
        disposer1.deleteNode(testNode);
        ko.cleanNode(testNode);
        value_of(didRun1).should_be(false);
        value_of(didRun2).should_be(true);
    }
});