## Knockout Grand

### Concise and expressive binding syntax

1.  For bindings that accept key/value pairs (`attr`, `css`, `style`, and `event`), you can use an alternate syntax, `binding.key: value`. The new syntax unclutters the binding of excess curly braces and clearly expresses that each “sub-binding” is separate and independent. Quotes are also now generally unnecessary, even for non-identifier attributes. 

    ```html
    <a data-bind="attr.href: url, attr.title: details">Report</a>
    <div data-bind="css.my-class: someValue">...</div>
    <li data-bind="text: $data, event.mouseover: $parent.logMouseOver"></li>
    ```

2.	For event-handler bindings (`click`, `event`, and `submit`), you can directly specify a function property, which will be called with `this` set to the correct object. In the example below, when the button is clicked, `removePlace` will be called with `this` set to the `$parent` object. (Previously, `this` would have been set to `$data` unless you used something like `click: $parent.removePlace.bind($parent)`.)

    ```html
    <button data-bind="click: $parent.removePlace">Remove</button>
    ```

3.	As an alternative to using `$data`, `$parent`, etc., to access the view model objects, you can give a custom name to the model at each binding context level.

    To specify the name of the root model (as an alternative to `$root`), you can use an option to `applyBindings`.

    ```javascript
    ko.applyBindings(myCompany, null, {rootModelName: 'company'});
    ```

    You can also give a name to the model (or anything else) using the new `let` binding.

    ``` 
    <!-- ko let: {company: $root} -->
    ...
    <!-- /ko -->
    ```

    To specify the name of the model in a child context, you can use the `as` option with `foreach`, `with`, `withlight`, or `template`.
 
    ```html
    <ul data-bind="foreach: myItems as item">
        <li data-bind="text: item"></li>
    </ul>
    <div data-bind="with: page as page">...</div>
    ```

    You can also use these alternate formats for `as`.

    ```html
    <ul data-bind="foreach: myItems, as: 'item'">
    <ul data-bind="foreach: { data: myItems, as: 'item' }">
    <ul data-bind="template: { foreach: myItems, as: 'item' }">
    ```

4.	`uniqueName` can be specified without a value (leaving off `: true`).

    ```html
    <input data-bind="value: someModelProperty, uniqueName" />
    ```

### Efficient UI synchronization

1.	Order of bindings

2.	Independent updates of bindings

3.	Withlight binding and new with binding

4.	Interdependence of bindings (checked and attr.value)

5.	Specify dependencies using `needs`

6.	Able to use init and track all dependencies
