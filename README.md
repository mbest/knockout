## Better Binding for Knockout

### What’s great about Knockout?

* Provides a concise way to link data to the UI through declarative bindings.
* Automatically updates the UI based on changing data using observables.

### What’s new and improved in this update?

1. When an element in the UI has multiple bindings, each binding is processed separately. For example, an element might have bindings for its color and for its text contents. Previously, when Knockout needed to update the color, it would also update the text (even though the data for the text hadn’t changed). With this update, Knockout will only process the binding that needs it.
2. Multiple bindings for an element are processed in a more logical order. For example, a `select` element might have the `options` and `selectedOptions` bindings. Previously, the bindings were processed in the order they were given in the element’s `data-bind` attribute. So if `selectedOptions` was listed first, it would fail to initialize the selected options since the options wouldn’t be in the UI yet. With this update, Knockout knows more about what the bindings do, which it uses to determine which bindings to process first.
3. Two-level bindings can be specified using one-level syntax. For example, when binding the load event, you could use `event.load: handler` instead of `event { load: handler }`. Both forms can used, with no functional difference between the two.
4. Bindings whose only valid value is *true* can be specified without the value. The only built-in binding this applies to is `uniqueValue`. So you could use `uniqueValue` instead of `uniqueValue: true`.
5. Event handler functions are called with the correct `this` value when just the function value is given. Previously, the `event` binding called all handler functions with `this` set to the value of `$data`. With this update, if you specify `click: $parent.handler`, the handler function will be called with `this` set to `$parent`. Previously to get that same functionality, you’d have to use `click: function() { $parent.handler() }` or `click: $parent.handler.bind($parent)`
6. The `with` binding has been split into two bindings: `with` and `withif`. The new `with` binding doesn’t use the template code and thus is much faster and simpler. It doesn’t modify it’s contents but just pushes a new binding context. The `withif` binding provides the same functionality of the previous `with` binding.
7. The `text` binding can now be used with container-less syntax: `<!--ko text: value--><!--/ko-->`.
8. Custom bindings can be set up to run after their descendants’ bindings have run by using the `contentUpdate` flag (see below). This is useful if a binding modifies its descendant elements and needs them to be initialized first.
9. The minified code is smaller. Even with a lot of new features (and some additional error reporting), the minified version of this update is slightly smaller than the current master *head*.

### What are the new interfaces in this update?

1. Binding handlers can set a `flags` property to tell Knockout how the binding is used. Many bindings won’t need to set any flags. The flags are numeric and multiple flags can be set by ORing them together: `flags: ko.bindingFlags.twoWay | ko.bindingFlags.contentSet`. The following are the available flags:
   * `twoWay`: initialliy writes to the DOM from the model and updates the model property if the DOM changes
   * `eventHandler`: calls the given function in response to an event
   * `twoLevel`: expects a set of key/value pairs; these can be specified as `binding.key: value` or `binding: {key: value}`
   * `contentSet`: erases or sets the element’s contents
   * `contentBind`: has responsibility for binding (or not) the element’s contents
   * `contentUpdate`: modifies or accesses the element’s contents after the content’s bindings have been processed
   * `canUseVirtual`: can be used in container-less elements like `<!-- ko if: value --><!-- /ko -->`
   * `noValue`: doesn’t require a value (default value is *true*)
2. `bindingContext.createChildContext` will accept an observable as a data value, which it will automatically unwrap and track for changes. A binding handler that uses this feature avoids having to create a new context and re-bind its descendants if the data value changes.
3. `ko.cleanAndRemoveNode` is a more descriptive synonym for `ko.removeNode`.
4. `ko.computed` exports two new methods: `addDisposalNodes` and `replaceDisposalNodes`. The former can be used instead of (or in addition to) the `disposeWhenNodeIsRemoved` option. The big change is that computed observables can track multiple nodes, which can be changed dynamically. Only when all of the tracked nodes are removed will it be disposed.
5. Binding handler functions are called with `this` set to the handler object. This allows binding handlers to use general OO functionality such as inheritance.
6. `ko.applyBindingsToNode` accepts a fourth parameter, `shouldBindDescendants`.

### What compatibility issues are there with this update?

1. Users may have custom bindings that rely on being updated when other bindings on the same element are updated. Since this will not be the case with this update (see item #1 above), users must change those custom bindings to specifically subscribe to the model data that should trigger an update.
2. Users may rely on a custom binding being processed after another binding based on the order specified in the `data-bind` attribute. But bindings will instead be ordered based on their type (see item #2). To help users debug such problems, Knockout will output a warning message to the browser’s console if the actual run order of the bindings differs from the specified one. Users can solve this problem by specifying an appropriate type for their custom bindings.
3. Users using `with` that expect it to clear it’s contents if the given value is false (or falsy) should switch to using `withif`.
4. Users may assume that `this` in an event handler function will be the same as `$data`. But `this` will now be set to the handler’s object (see item #5). The `$data` object is always passed to the function as the first parameter, and users should update their code to use that instead: `function(data) { dosomethingwith(data); }` instead of `function() { dosomethingwith(this); }`
5. Any custom binding that manages the binding of its descendants will need to be changed. It should no longer return a specific object value from its `init` function (doing so will trigger an error). Instead it must set a `flags` property for the handler with a value of `ko.bindingFlags.contentBind` (see above for the full list of flags).
6. `ko.virtualElements.allowedBindings` is no longer used to determine which bindings can be used in container-less elements. Use the `canUseVirtual` flag instead (see above).
7. Two Knockout objects are no longer exported: `ko.utils.domNodeDisposal` and `ko.jsonExpressionRewriting`. Both objects were heavily modified in this update, and rather than explaining the changes, it was simpler (and space saving) to not export them.
8. The last parameter to `utils.setDomNodeChildrenFromArrayMapping` is a callback function that is called after nodes are added to the document. Anyone using this function and providing that callback will need to update their code to include a third parameter, `subscription`, and call `addDisposalNodes` on the subscription with any of the given nodes that should be watched.
9. Observables accessed within a binding’s `init` function will not be tracked and thus will not trigger updates for that binding. Only observables accessed in the `update` function will be tracked.
10. The `text` binding will always create a single text node. Previously some browsers would convert new-lines in the text into `br` nodes. Now they will stay as new-lines in a single text node. Use the `white-space: pre-wrap` style to format the text.

### The following bugs were fixed as part of this update:

1. There are various bugs that occur if the `value` binding is run before the `options` bindings. Since the changes in this update ensure that `options` is always run before `value`, these bugs are fixed with this update:
   * Removing the currently selected item from the array (or clearing the whole array) will now correctly clear the value. (Previously the value would not be updated.)
   * If there are no options, setting the value’s observable to any value will now reset the value to *undefined*. (Previously the value would be accepted.)
2. `ko.computed` now prevents itself from being called recursively. In other words, if a computed observables’s `read` function somehow triggers itself to be re-evaluated, that inner evaluation will not happen. (Previously such a situation would result in a Javascript stack error.)
3. For two-level bindings such as `attr` and `css`, the sub keys no longer need to be quoted (see [#233](https://github.com/SteveSanderson/knockout/issues/233)).

### Are there any other issues to watch for with this update?

1. Processing bindings involves two steps: parsing the binding string to create a function that returns an object, and then calling the binding handlers for each of the properties in that object. Since Knockout uses a cache for the parsing step, each time the same binding string is processed, it will use the same function (with the same object structure) as the first time. With this update, the parsing code uses certain binding handler flags to determine the object structure. Thus the parsing step is no longer deterministic; the cache could become invalid if the type of a binding handler was changed. However, because this is such a fringe case, the cache will always return the original function even if the flags have changed. Either avoid changing the flags for a binding handler after applyBindings is run, or call `ko.bindingProvider.instance.clearCache` (this is a new function) after the flags are changed.
