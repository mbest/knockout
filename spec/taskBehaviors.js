describe('Delayed tasks', function() {
    beforeEach(function() {
        jasmine.Clock.useMock();
    });

    afterEach(function() {
        // Check that task schedule is clear after each test
        expect(ko.tasks.processAll()).toEqual(0);
    });

    it('Should run in next execution cycle', function() {
        var runCount = 0;
        ko.tasks.defer(function() {
            runCount++;
        });
        expect(runCount).toEqual(0);

        jasmine.Clock.tick(1);
        expect(runCount).toEqual(1);
    });

    it('Should run multiple times if distinct is false (default)', function() {
        var runCount = 0;
        var func = function() {
            runCount++;
        };
        ko.tasks.defer(func);
        ko.tasks.defer(func);
        expect(runCount).toEqual(0);

        jasmine.Clock.tick(1);
        expect(runCount).toEqual(2);
    });

    it('Should only run once even if scheduled more than once if distinct is true', function() {
        var runCount = 0;
        var func = function() {
            runCount++;
        };
        ko.tasks.defer(func, {distinct:true});
        ko.tasks.defer(func, {distinct:true});
        expect(runCount).toEqual(0);

        jasmine.Clock.tick(1);
        expect(runCount).toEqual(1);
    });

    it('Should use options from last scheduled call', function() {
        var runValue;
        var func = function(value) {
            runValue = value;
        };
        ko.tasks.defer(func, {args:[1]});
        ko.tasks.defer(func, {args:[2]});
        expect(runValue).toBeUndefined();

        jasmine.Clock.tick(1);
        expect(runValue).toEqual(2);
    });

    it('Should run only once if tasks are processed early using processAll', function() {
        var runCount = 0;
        var func = function() {
            runCount++;
        };
        ko.tasks.defer(func);
        expect(runCount).toEqual(0);

        ko.tasks.processAll();
        expect(runCount).toEqual(1);
    });

    it('Should run again if scheduled after processAll', function() {
        var runValues = [];
        var func = function(value) {
            runValues.push(value);
        };
        ko.tasks.defer(func, {args:[1]});
        expect(runValues).toEqual([]);

        ko.tasks.processAll();
        expect(runValues).toEqual([1]);

        ko.tasks.defer(func, {args:[2]});

        jasmine.Clock.tick(1);
        expect(runValues).toEqual([1,2]);
    });

    it('Should run at the end of newContext', function() {
        var runCount = 0;

        ko.tasks.newContext(function() {
            ko.tasks.defer(function() {
                runCount++;
            });
            expect(runCount).toEqual(0);
        });
        expect(runCount).toEqual(1);
    });

    it('Should run at the end of newContext even if already scheduled outside (will run twice)', function() {
        var runValues = [];
        var func = function(value) {
            runValues.push(value);
        };
        ko.tasks.defer(func, {args:['o']});

        ko.tasks.newContext(function() {
            ko.tasks.defer(func, {args:['i']});
            expect(runValues).toEqual([]);
        });
        expect(runValues).toEqual(['i']);

        jasmine.Clock.tick(1);
        expect(runValues).toEqual(['i','o']);
    });

    it('Should run all scheduled tasks if processed early by processAll', function() {
        var runValues = [];
        var func = function(value) {
            runValues.push(value);
        };
        ko.tasks.defer(func, {args:['o']});

        ko.tasks.newContext(function() {
            ko.tasks.defer(func, {args:['i']});
            ko.tasks.processAll();
            expect(runValues).toEqual(['o','i']);
        });
    });

    it('Should ignore call to processAll during task processing', function() {
        var runValues = [];
        var func = function(value) {
            runValues.push(value);
            ko.tasks.processAll();
        };
        ko.tasks.defer(func, {args:['o']});

        ko.tasks.newContext(function() {
            ko.tasks.defer(func, {args:['i']});
            expect(runValues).toEqual([]);
        });
        // If ko.tasks.processAll wasn't ignored, then both tasks would have already run
        expect(runValues).toEqual(['i']);

        jasmine.Clock.tick(1);
        expect(runValues).toEqual(['i','o']);
    });

    it('Should process newly scheduled tasks during task processing', function() {
        var runValues = [];
        var func = function(value) {
            runValues.push(value);
            ko.tasks.defer(function() {
                runValues.push('x');
            });
        };

        ko.tasks.newContext(function() {
            ko.tasks.defer(func, {args:['i']});
            expect(runValues).toEqual([]);
        });
        expect(runValues).toEqual(['i','x']);
    });

    it('Should run at the end of each newContext when nested', function() {
        var runValues = [];
        var func = function(value) {
            runValues.push(value);
        };
        ko.tasks.newContext(function() {
            ko.tasks.defer(func, {args:['o']});

            ko.tasks.newContext(function() {
                ko.tasks.defer(func, {args:['i']});
                expect(runValues).toEqual([]);
            });
            expect(runValues).toEqual(['i']);
        });
        expect(runValues).toEqual(['i','o']);
    });

    it('Should keep correct state if task throws an exception', function() {
        var runValues = [];
        var func = function(value) {
            runValues.push(value);
        };
        ko.tasks.newContext(function() {
            ko.tasks.defer(func, {args:['o']});

            expect(function() {
                ko.tasks.newContext(function() {
                    ko.tasks.defer(func, {args:['i']});
                    ko.tasks.defer(function() {
                        throw Error("test");
                    });
                    expect(runValues).toEqual([]);
                });
            }).toThrow();
            expect(runValues).toEqual(['i']);
        });
        expect(runValues).toEqual(['i','o']);
    });

});