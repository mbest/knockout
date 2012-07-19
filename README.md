## Knockout Grand

### What’s great about Knockout?

* Provides a concise way to link data to the UI through declarative bindings.
* Automatically updates the UI based on changing data using observables.

### What’s new and improved in this update?

1. Multiple bindings for an element are processed in a more logical order. For example, a `select` element might have the `options` and `selectedOptions` bindings. Previously, the bindings were always processed in the order they were given in the element’s `data-bind` attribute. So if `selectedOptions` was listed first, it would fail to initialize the selected options since the options wouldn’t be in the UI yet. With this update, Knockout knows more about what the bindings do, which it uses to determine which bindings to process first.
2. `applyBindings` accepts an option, `independentBindings`, to process bindings separately when elements in the UI have multiple bindings. For example, an element might have bindings for its color and for its text contents. Normally, when Knockout needs to update the color, it will also update the text (even though the data for the text hasn’t changed). With this option (see below under new interfaces), Knockout will only process the binding that needs it.
3. Two-level bindings can be specified using one-level syntax. For example, when binding the load event, you could use `event.load: handler` instead of `event { load: handler }`. Both forms can be used, with no functional difference between the two.
4. Bindings whose only valid value is *true* can be specified without the value. The only built-in binding this applies to is `uniqueValue`. So you could use `uniqueValue` instead of `uniqueValue: true`.
5. `applyBindings` accepts an option, `eventHandlersUseObjectForThis`, so that event handler functions are called with the correct `this` value when just the function value is given. Normally, the event bindings call all handler functions with `this` set to the value of `$data`. With this option, if you specify `click: $parent.handler`, the handler function will be called with `this` set to `$parent`. Previously to get that same functionality, you’d have to use `click: function(data) { $parent.handler(data) }` or `click: $parent.handler.bind($parent)`. If you use this option, you can still access the `$data` value via the first parameter to the function.
6. The `withlight` binding is added. `withlight` doesn’t uses the template code and thus is faster and more efficient than `with`. It won’t clear and re-create its contents, but can’t accept *falsy* values.
7. The `text` binding can now be used with container-less syntax: `<!--ko text: value--><!--/ko-->`.
8. Custom bindings can be set up to run after their descendants’ bindings have run by using the `contentUpdate` flag (see the section below for how to set the flags). This is useful if a binding modifies its descendant elements and needs them to be initialized first.
9. Bindings can be dependent on other bindings. Dependencies can be set either by the binding handler or in the `data-bind` string. If binding *B* is dependent on binding *A*, Knockout will ensure that *A* is present whenever *B* is present (will report an error if *A* is not), that *A* is run before *B* (but if that can’t happen because of the bindings’ flags, it will report an error), and that *B* is updated whenever *A* is updated (applies only when running in independent mode).
10. Binding handlers can safely use the `init` function to set up a computed observable to manage updates even if observables are unwrapped during the parsing stage.
11. The minified code is only slightly larger. Even with a lot of new features (and some additional error reporting), the minified version of this update is less than 2% larger than the current master *head* (for comparison, the debug version is over 9% larger).

### What are the new interfaces in this update?

1. Binding handlers can set a `flags` property to tell Knockout how the binding is used. Many bindings won’t need to set any flags. The flags are numeric and multiple flags can be set by ORing them together: `flags: ko.bindingFlags.twoWay | ko.bindingFlags.contentSet`. The following are the available flags:
   * `twoWay`: For bindings that need to update the model property if the DOM changes. This flag is for built-in bindings to ensure that they can write to non-observable properties.
   * `eventHandler`: For bindings that call a given function in response to an event. This flag tells the binding parser that the value of the binding is a function, and that the parser can modify the value so that `this` is set correctly (see item 5 above).
   * `twoLevel`: For bindings that expect a set of key/value pairs. This flag tells the binding parser to accept both `binding.key: value` and `binding: {key: value}` for the binding. Either way, the binding handler will be passed the value as `{key: value}`.
   * `contentSet`: For bindings that erase or set the element’s contents. Bindings with this flag are processed right before bindings with the `contentBind` or `contentUpdate` flags. Also this flag tells re-writable template engines that it’s safe to use the binding.
   * `contentBind`: For bindings that are responsible for binding (or not) the element’s contents. Bindings should use this flag to indicate that the contents of the element shouldn’t be processed, or that the binding handler will process the bindings of its contents. Bindings with this flag will be run after `contentSet` bindings but before `contentUpdate` bindings. Also this flag tells re-writable template engines that it’s **not** safe to use (unless the binding also has the `contentSet` flag).
   * `contentUpdate`: For bindings that modify or accesses the element’s contents after the content’s bindings have been processed. Bindings with this flag are run after all other bindings for that element and after the element’s contents have been processed.
   * `canUseVirtual`: For bindings that can be used in container-less elements like `<!-- ko if: value --><!-- /ko -->`.
   * `noValue`: For bindings that don’t require a value (default value is *true*).
2. `ko.applyBindings` accepts a third parameter, `options`, that currently accepts two options, `independentBindings` and `eventHandlersUseObjectForThis`. See items 2 and 5 above for a description of what these options do. Here’s how you would call `ko.applyBindings` with options: `ko.applyBindings(viewModel, node, {independentBindings: true});`
3. `bindingContext.createChildContext` will accept an observable or a function as a data value, which it will automatically unwrap and track for changes. A binding handler that uses this feature avoids having to create a new context and re-bind its descendants if the data value changes.
4. `ko.cleanAndRemoveNode` is a more descriptive synonym for `ko.removeNode`.
5. `ko.computed` exports two new methods: `addDisposalNodes` and `replaceDisposalNodes`. The former can be used instead of (or in addition to) the `disposeWhenNodeIsRemoved` option. The big change is that computed observables can track multiple nodes, which can be changed dynamically. Only when all of the tracked nodes are removed will it be disposed.
6. `ko.applyBindingsToNode` accepts a fourth parameter, `shouldBindDescendants`.
7. `ko.bindingProvider.instance.clearCache` is a new function that lets you clear the binding cache. (See the last section for why you might want to use it.)
8. The last parameter to `utils.setDomNodeChildrenFromArrayMapping` is a callback function that is called after nodes are added to the document. This callback is now passed a third parameter, `subscription`, on which it can call `addDisposalNodes` with any of the given nodes that should be watched. If the callback doesn’t call `addDisposalNodes`, `setDomNodeChildrenFromArrayMapping` will just watch all the nodes.
9. Binding handlers can set a `dependencies` property to specify which other bindings they are dependent on. For a single dependency, the value should be the name of the binding as a string: `dependencies: 'nameOfBinding'`. For multiple dependencies, the value should be an array: `dependencies: ['binding1', 'binding2']`. Dependencies can also be specified in the `data-bind` attribute using the same syntax. If dependencies are specified in both locations, they will be added to each other.

### What compatibility issues are there with this update?

1. Bindings will not always run in the order specified in the `data-bind` attribute. Bindings that have the `contentSet` flag will run before those that have `contentBind`, which will run before those that have `contentUpdate`. Any other bindings will run after the bindings that precede them in the `data-bind` attribute. Here are the built-in bindings whose run order could be affected:
   1. Bindings with `contentSet`: none (Some have `contentSet`, but they also have `contentBind` which takes priority.)
   2. Bindings with `contentBind`: `options`, `text`, `html`, `with`, `withif`, `if`, `ifnot`, `foreach`, `template`
   3. Bindings with `contentUpdate`: `value`, `selectedOptions`
2. A custom binding that manages the binding of its descendants will need to be changed to work with the independent binding setting. In addition to (or instead of) returning a specific object value from its `init` function, it must set a `flags` property for the handler with a value of `ko.bindingFlags.contentBind` (see above for the full list of flags).
3. `ko.virtualElements.allowedBindings` is deprecated in favor of the `canUseVirtual` flag (see description of flags above).
4. `ko.jsonExpressionRewriting` is no longer exported. It was heavily modified in this update, and rather than explaining the changes, it was simpler (and space saving) to not export it. `ko.jsonExpressionRewriting.bindingRewriteValidators` is now exported as just `ko.bindingRewriteValidators`.
5. The `text` binding will always create a single text node. Previously some browsers would convert new-lines in the text into `br` nodes. Now they will stay as new-lines in a single text node. Use the `white-space: pre-wrap` style to format the text.
6. If a normal binding (not listed in item 1 in this section) is specified after a `contentUpdate` binding, it will also be run after the element’s contents have been processed. Probably this won’t be an issue most of the time, but it may be something to watch out for.
7. If a binding handler manages updates through its own computed observable, it will need to be modified to work well with dependencies. To support dependencies, it will need to return the computed observable from its `init` or `update` function (whichever one creates it). From the `init` function, it should return an object with a `subscribable` property set to the computed observable; from the `update` function, it should just return the computed observable directly.

### The following bugs were fixed as part of this update:

1. There are various bugs that occur if the `value` binding is run before the `options` bindings. Since the changes in this update ensure that `options` is always run before `value`, these bugs are fixed with this update:
   * Removing the currently selected item from the array (or clearing the whole array) will now correctly clear the value. (Previously the value would not be updated.)
   * If there are no options, setting the value’s observable to any value will now reset the value to *undefined*. (Previously the value would be accepted.)
2. `ko.computed` now prevents itself from being called recursively. In other words, if a computed observables’s `read` function somehow triggers itself to be re-evaluated, that inner evaluation will not happen. (Previously such a situation would result in a Javascript stack error.)
3. For two-level bindings such as `attr` and `css`, the sub keys no longer need to be quoted (see [#233](https://github.com/SteveSanderson/knockout/issues/233)).

### Are there any other issues to watch for with this update?

1. Processing bindings involves two steps: parsing the binding string to create a function that returns an object, and then calling the binding handlers for each of the properties in that object. Since Knockout uses a cache for the parsing step, each time the same binding string is processed, it will use the same function (with the same object structure) as the first time. With this update, the parsing code uses certain binding handler flags to determine the object structure. Thus the parsing step is no longer deterministic; the cache could become invalid if the type of a binding handler was changed. However, because this is such a fringe case, the cache will always return the original function even if the flags have changed. Either avoid changing the flags for a binding handler after applyBindings is run, or call `ko.bindingProvider.instance.clearCache` (this is a new function) after the flags are changed.
