Better Binding for Knockout

What’s great about Knockout?

* Provides a concise way to link data to the UI through declarative bindings.
* Automatically updates the UI based on changing data using observables.

What’s new and improved in this update?

1. When an element in the UI has multiple bindings, each binding is processed separately. For example, an element might have bindings for its color and for its text contents. Previously, when Knockout needed to update the color, it would also update the text (even though the data for the text hadn’t changed). With this update, Knockout will only process the binding that needs it.
2. Multiple bindings for an element are processed in a more logical order. For example, a `select` element might have the `options` and `selectedOptions` bindings. Previously, the bindings were processed in the order they were given in the element’s `data-bind` attribute. So if `selectedOptions` was listed first, it would fail to initialize the selected options since the options wouldn’t be in the UI yet. With this update, Knockout knows more about what the bindings do, which it uses to determine which bindings to process first.
3. Two-level bindings can be specified using one-level syntax. For example, when binding the load event, you could use `event.load: handler` instead of `event { load: handler }`. Both forms can used, with no functional difference between the two.
4. Bindings whose only valid value is *true* can be specified without the value. The only built-in binding this applies to is `uniqueValue`. So you could use `uniqueValue` instead of `uniqueValue: true`.
5. Event handler functions are called with the correct `this` value when just the function value is given. Previously, all handler functions were called with `this` set to the value of `$data`. With this update, if you specify `click: $parent.handler`, the handler function will be called with `this` set to `$parent`.  This is equivalent to `click: function() { $parent.handler() }` or `click: $parent.handler.bind($parent)`
6. Certain bindings can be set up to run after their descendants’ bindings have run. This is useful if a binding modifies its descendant elements and needs them to be initialized first.
7. The minified code is smaller. Even with a lot of new features (and some additional error reporting), the minified version of this update is slightly smaller than the current master *head*.

What compatibility issues are there with this update?

1. Users may have custom bindings that rely on being updated when other bindings on the same element are updated. Since this will not be the case with this update (see item #1 above), users must change those custom bindings to specifically subscribe to the model data that should trigger an update.
2. Users may rely on bindings being processed in the order given in the `data-bind` attribute. But binding will instead be ordered based on their type (see item #2). To help users debug such problems, Knockout will output a warning message to the browser’s console if the actual run order of the bindings differs from the specified one. Users can solve this problem by specifying an appropriate type for their custom bindings.
3. Users may assume that `this` in an event handler function will be the same as `$data`. But `this` will now be set to the handler’s object (see item #5). The `$data` object is always passed to the function as the first parameter, and users should update their code to use that instead: `function(data) { dosomethingwith(data); }` instead of `function() { dosomethingwith(this); }`
4. Any custom binding that manages that binding of its descendants will need to be changed. It should no longer return a specific object value from its `init` function (doing so will trigger an error). Instead it must set a `flags` property for the handler with a value of ko.bindingFlags.contentBind (see below for the full list of flags).
5. `ko.virtualElements.allowedBindings` is no longer used to determine which bindings can be used in container-less elements. Use the `canUseVirtual` flag instead (see below).
5. Some Knockout objects are no longer exported: `ko.utils.domNodeDisposal` and `ko.jsonExpressionRewriting`. These objects were heavily modified in this update, and rather than explaining the changes, it was simpler (and space saving) to not export them.
6. The last parameter to `utils.setDomNodeChildrenFromArrayMapping` is a callback function that is called after nodes are added to the document. Anyone using this function and providing that callback will need to update their code to include a third parameter, `subscription` and call `addDisposalNodes` on the subscription with any of the given nodes that should be watched.
7. Observables accessed within a binding’s `init` function will not be tracked and thus will not trigger updates for that binding. Only bindings accessed in the `update` function will be tracked.
8. `ko.applyBindingsToNode` no longer returns a value. Previously code using that function could read the return value to determine whether to bind descendant nodes (if they wanted to). Now, instead call `ko.applyBindingsToNode` with a fourth parameter (`shouldBindDescendants`) of *true*.

What are the new interfaces in this update?

1. Binding handler can set a `flags` property to tell Knockout how the binding is used. Many bindings won’t need to set any flags. The flags are numeric and multiple flags can be set by ORing them together: `flags: ko.bindingFlags.twoWay | ko.bindingFlags.contentSet`. The following are the available flags:
   * `twoWay`: initialliy writes to the DOM from the model and updates the model property if the DOM changes
   * `eventHandler`: calls the given function in response to an event
   * `contentSet`: erases or sets the element’s contents
   * `contentBind`: has responsibility for binding (or not) the element’s contents
   * `contentUpdate`: modifies or accesses the element’s contents after the content’s bindings have been processed
   * `noValue`: doesn’t require a value (default value is *true*)
   * `twoLevel`: expects a set of key/value pairs; these can be specified as `binding.key: value` or `binding: {key: value}`
   * `canUseVirtual`: can be used in container-less elements like `<!-- ko if: value --><!-- /ko -->`
2. `bindingContext.createChildContext` will accept an observable as a data value, which it will automatically unwrap and track for changes. A binding handler that uses this feature avoids having to create a new context and re-bind its descendants if the data value changes.
3. `ko.cleanAndRemoveNode` is a more descriptive synonym `ko.removeNode`.
4. `ko.computed` exports two new methods: `addDisposalNodes` and `replaceDisposalNodes`. The former can be used instead of (or in addition to) the `disposeWhenNodeIsRemoved` option. The big change is that computed observables can track multiple nodes, which can be changed dynamically. Only when all of the tracked nodes are removed will it be disposed.
5. Binding handler functions are called with `this` set to the handler object. This allows binding handlers to use general OO functionality such as inheritance.

This update was not meant to fix bugs. However the following bugs were fixed:

1. For `select` elements with both `options` and `value` bindings, removing the currently selected item from the array (or clearing the whole array) will now correctly clear the value. (Previously the value would not be updated.)
1. For `select` elements with no options and with a `value` binding, setting the value’s observable to any value will now reset the value to *undefined*. (Previously the value would be accepted.)
1. `ko.computed` now prevents itself from being called recursively. In other words, if a computed observables’s `read` function somehow triggers itself to be re-evaluated, that inner evaluation will not happen. (Previously such a situation would result in a Javascript stack error.)

