describe('Expression Rewriting', function() {
    var savedHandlers;
    beforeEach(function () {
        if (savedHandlers)
            ko.bindingHandlers = savedHandlers;
        savedHandlers = ko.utils.extend({}, ko.bindingHandlers);
    });

    it('Should be able to parse simple object literals', function() {
        var result = ko.expressionRewriting.parseObjectLiteral("a: 1, b: 2, \"quotedKey\": 3, 'aposQuotedKey': 4");
        expect(result.length).toEqual(4);
        expect(result[0][0]).toEqual("a");
        expect(result[0][1]).toEqual("1");
        expect(result[1][0]).toEqual("b");
        expect(result[1][1]).toEqual("2");
        expect(result[2][0]).toEqual("quotedKey");
        expect(result[2][1]).toEqual("3");
        expect(result[3][0]).toEqual("aposQuotedKey");
        expect(result[3][1]).toEqual("4");
    });

    it('Should ignore any outer braces', function() {
        var result = ko.expressionRewriting.parseObjectLiteral("{a: 1}");
        expect(result.length).toEqual(1);
        expect(result[0][0]).toEqual("a");
        expect(result[0][1]).toEqual("1");
    });

    it('Should ignore trailing commas', function() {
        var result = ko.expressionRewriting.parseObjectLiteral("a: 1, b: 2,");
        expect(result.length).toEqual(2);
        expect(result[0][0]).toEqual("a");
        expect(result[0][1]).toEqual("1");
        expect(result[1][0]).toEqual("b");
        expect(result[1][1]).toEqual("2");
    });

    it('Should be able to parse object literals containing string literals', function() {
        var result = ko.expressionRewriting.parseObjectLiteral("a: \"comma, colon: brace{ bracket[ apos' escapedQuot\\\" end\", b: 'escapedApos\\\' brace} bracket] quot\"'");
        expect(result.length).toEqual(2);
        expect(result[0][0]).toEqual("a");
        expect(result[0][1]).toEqual("\"comma, colon: brace{ bracket[ apos' escapedQuot\\\" end\"");
        expect(result[1][0]).toEqual("b");
        expect(result[1][1]).toEqual("'escapedApos\\\' brace} bracket] quot\"'");
    });

    it('Should be able to parse object literals containing child objects, arrays, function literals, and newlines', function() {
        // The parsing may or may not keep unnecessary spaces. So to avoid confusion, avoid unnecessary spaces.
        var result = ko.expressionRewriting.parseObjectLiteral(
            "myObject:{someChild:{},someChildArray:[1,2,3],\"quotedChildProp\":'string value'},\n"
          + "someFn:function(a,b,c){var regex=/}/;var str='/})({';return{};},"
          + "myArray:[{},function(){},\"my'Str\",'my\"Str']"
        );
        expect(result.length).toEqual(3);
        expect(result[0][0]).toEqual("myObject");
        expect(result[0][1]).toEqual("{someChild:{},someChildArray:[1,2,3],\"quotedChildProp\":'string value'}");
        expect(result[1][0]).toEqual("someFn");
        expect(result[1][1]).toEqual("function(a,b,c){var regex=/}/;var str='/})({';return{};}");
        expect(result[2][0]).toEqual("myArray");
        expect(result[2][1]).toEqual("[{},function(){},\"my'Str\",'my\"Str']");
    });

    it('Should be able to cope with malformed syntax (things that aren\'t key-value pairs)', function() {
        var result = ko.expressionRewriting.parseObjectLiteral("malformed1, 'mal:formed2', good:3, { malformed: 4 }, good5:5");
        expect(result.length).toEqual(5);
        expect(result[0][0]).toEqual("malformed1");
        expect(result[1][0]).toEqual("mal:formed2");
        expect(result[2][0]).toEqual("good");
        expect(result[2][1]).toEqual("3");
        expect(result[4][0]).toEqual("good5");
        expect(result[4][1]).toEqual("5");
        // There's not really a good 'should' value for "{ malformed: 4 }", so don't check
    });

    it('Should ensure all keys are wrapped in quotes', function() {
        var rewritten = ko.expressionRewriting.preProcessBindings("a: 1, 'b': 2, \"c\": 3");
        expect(rewritten).toEqual("'a':1,'b':2,'c':3");
    });

    it('Should convert keys without values to key:true', function() {
        ko.bindingHandlers.b = { flags:bindingFlags_noValue };
        var rewritten = ko.expressionRewriting.preProcessBindings("a: 1, b");
        var parsedRewritten = eval("({" + rewritten + "})");
        expect(parsedRewritten.a).toEqual(1);
        expect(parsedRewritten.b).toEqual(true);
    });

    it('Should convert values to property accessors', function () {
        var h = ko.bindingHandlers;
        h.a = h.b = h.c = h.d = h.e = h.f = h.g = h.h = h.i = h.j = { flags: ko.bindingFlags.twoWay };
        var rewritten = ko.expressionRewriting.preProcessBindings(
            'a : 1, b : firstName, c : function() { return "returnValue"; }, ' +
            'd: firstName+lastName, e: boss.firstName, f: boss . lastName, ' +
            'g: getAssitant(), h: getAssitant().firstName, i: getAssitant("[dummy]")[ "lastName" ], ' +
            'j: boss.firstName + boss.lastName'
        );
        var assistant = { firstName: "john", lastName: "english" };
        var model = {
            firstName: "bob", lastName: "smith",
            boss: { firstName: "rick", lastName: "martin" },
            getAssitant: function() { return assistant }
        };
        with (model) {
            var parsed = eval("({" + rewritten + "})");
            // test values of property
            expect(parsed.a).toEqual(1);
            expect(parsed.b).toEqual("bob");
            expect(parsed.c()).toEqual("returnValue");
            expect(parsed.d).toEqual("bobsmith");
            expect(parsed.e).toEqual("rick");
            expect(parsed.f).toEqual("martin");
            expect(parsed.g()).toEqual(assistant);
            expect(parsed.h()).toEqual("john");
            expect(parsed.i()).toEqual("english");

            // test that only writable expressions are set up for writing
            // 'j' matches due to the simple checking for trailing property accessor
            expect(parsed._ko_property_writers).toHaveOwnProperties(['b','e','f','h','i','j']);

            // make sure writing to them works
            parsed._ko_property_writers.b("bob2");
            expect(model.firstName).toEqual("bob2");
            parsed._ko_property_writers.e("rick2");
            expect(model.boss.firstName).toEqual("rick2");
            parsed._ko_property_writers.f("martin2");
            expect(model.boss.lastName).toEqual("martin2");
            parsed._ko_property_writers.h("john2");
            expect(assistant.firstName).toEqual("john2");
            parsed._ko_property_writers.i("english2");
            expect(assistant.lastName).toEqual("english2");

            // make sure writing to 'j' doesn't error or actually change anything
            parsed._ko_property_writers.j("nothing at all");
            expect(model.boss.firstName).toEqual("rick2");
            expect(model.boss.lastName).toEqual("martin2");
        }
    });

    it('Should convert a variety of values to property accessors', function () {
        ko.bindingHandlers.b = { flags: ko.bindingFlags.twoWay | ko.bindingFlags.twoLevel };
        var rewritten = ko.expressionRewriting.preProcessBindings('b.a: prop1, b.b: obj2.prop2, b.c: obj2["prop2"], b.d: getObj().prop2');

        var model = { prop1: "bob", obj2: { prop2: "jones" }, getObj: function() { return this.obj2 } };
        with (model) {
            var parsedRewritten = eval("({" + rewritten + "})");
            expect(parsedRewritten['b.a']).toEqual("bob");
            expect(parsedRewritten['b.b']).toEqual("jones");
            expect(parsedRewritten['b.c']).toEqual("jones");
            expect(parsedRewritten['b.d']()).toEqual("jones");
            var accessor = function(key) { return parsedRewritten[key]; };

            // update simple property
            ko.expressionRewriting.writeValueToProperty(null, accessor, 'b.a', "stan");
            expect(model.prop1).toEqual("stan");

            // update sub-property (two methods)
            ko.expressionRewriting.writeValueToProperty(null, accessor, 'b.b', "smith");
            expect(model.obj2.prop2).toEqual("smith");
            ko.expressionRewriting.writeValueToProperty(null, accessor, 'b.c', "sloan");
            expect(model.obj2.prop2).toEqual("sloan");

            // update property of object returned by a function
            ko.expressionRewriting.writeValueToProperty(null, accessor, 'b.d', "smart");
            expect(model.obj2.prop2).toEqual("smart");
        }
    });

    it('Should be able to eval rewritten literals that contain unquoted keywords as keys', function() {
        var rewritten = ko.expressionRewriting.preProcessBindings("while: true");
        expect(rewritten).toEqual("'while':true");
        var evaluated = eval("({" + rewritten + "})");
        expect(evaluated['while']).toEqual(true);
    });

    it('Should be able to eval two-level bindings mixed with one-level bindings', function() {
        ko.bindingHandlers.a = { flags: ko.bindingFlags.twoLevel | ko.bindingFlags.twoWay };
        var rewritten = ko.expressionRewriting.preProcessBindings('a.f: firstName, b: false, a: {l: lastName}');

        var model = { firstName: "bob", lastName: "smith" };
        with (model) {
            var parsedRewritten = eval("({" + rewritten + "})");
            expect(parsedRewritten['a.f']).toEqual("bob");
            expect(parsedRewritten['a.l']).toEqual("smith");
            expect(parsedRewritten.b).toEqual(false);

            parsedRewritten._ko_property_writers['a.f']("bob2");
            expect(model.firstName).toEqual("bob2");
        }
    });
});
