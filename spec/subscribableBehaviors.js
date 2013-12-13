
describe('Subscribable', function() {
    it('Should declare that it is subscribable', function () {
        var instance = new ko.subscribable();
        expect(ko.isSubscribable(instance)).toEqual(true);
    });

    it('isSubscribable should return false for undefined', function () {
        expect(ko.isSubscribable(undefined)).toEqual(false);
    });

    it('isSubscribable should return false for null', function () {
        expect(ko.isSubscribable(null)).toEqual(false);
    });

    it('Should be able to notify subscribers', function () {
        var instance = new ko.subscribable();
        var notifiedValue;
        instance.subscribe(function (value) { notifiedValue = value; });
        instance.notifySubscribers(123);
        expect(notifiedValue).toEqual(123);
    });

    it('Should be able to unsubscribe', function () {
        var instance = new ko.subscribable();
        var notifiedValue;
        var subscription = instance.subscribe(function (value) { notifiedValue = value; });
        subscription.dispose();
        instance.notifySubscribers(123);
        expect(notifiedValue).toEqual(undefined);
    });

    it('Should be able to specify a \'this\' pointer for the callback', function () {
        var model = {
            someProperty: 123,
            myCallback: function (arg) { expect(arg).toEqual('notifiedValue'); expect(this.someProperty).toEqual(123); }
        };
        var instance = new ko.subscribable();
        instance.subscribe(model.myCallback, model);
        instance.notifySubscribers('notifiedValue');
    });

    it('Should not notify subscribers after unsubscription, even if the unsubscription occurs midway through a notification cycle', function() {
        // This spec represents the unusual case where during notification, subscription1's callback causes subscription2 to be disposed.
        // Since subscription2 was still active at the start of the cycle, it is scheduled to be notified. This spec verifies that
        // even though it is scheduled to be notified, it does not get notified, because the unsubscription just happened.
        var instance = new ko.subscribable();
        var subscription1 = instance.subscribe(function() {
            subscription2.dispose();
        });
        var subscription2wasNotified = false;
        var subscription2 = instance.subscribe(function() {
            subscription2wasNotified = true;
        });

        instance.notifySubscribers('ignored');
        expect(subscription2wasNotified).toEqual(false);
    });

    it('Should be able to notify subscribers for a specific \'event\'', function () {
        var instance = new ko.subscribable();
        var notifiedValue = undefined;
        instance.subscribe(function (value) { notifiedValue = value; }, null, "myEvent");

        instance.notifySubscribers(123, "unrelatedEvent");
        expect(notifiedValue).toEqual(undefined);

        instance.notifySubscribers(456, "myEvent");
        expect(notifiedValue).toEqual(456);
    });

    it('Should be able to unsubscribe for a specific \'event\'', function () {
        var instance = new ko.subscribable();
        var notifiedValue;
        var subscription = instance.subscribe(function (value) { notifiedValue = value; }, null, "myEvent");
        subscription.dispose();
        instance.notifySubscribers(123, "myEvent");
        expect(notifiedValue).toEqual(undefined);
    });

    it('Should be able to subscribe for a specific \'event\' without being notified for the default event', function () {
        var instance = new ko.subscribable();
        var notifiedValue;
        var subscription = instance.subscribe(function (value) { notifiedValue = value; }, null, "myEvent");
        instance.notifySubscribers(123);
        expect(notifiedValue).toEqual(undefined);
    });

    it('Should be able to retrieve the number of active subscribers', function() {
        var instance = new ko.subscribable();
        instance.subscribe(function() { });
        instance.subscribe(function() { }, null, "someSpecificEvent");
        expect(instance.getSubscriptionsCount()).toEqual(2);
    });

    it('Should be possible to replace notifySubscribers with a custom handler', function() {
        var instance = new ko.subscribable();
        var interceptedNotifications = [];
        instance.subscribe(function() { throw new Error("Should not notify subscribers by default once notifySubscribers is overridden") });
        instance.notifySubscribers = function(newValue, eventName) {
            interceptedNotifications.push({ eventName: eventName, value: newValue });
        };
        instance.notifySubscribers(123, "myEvent");

        expect(interceptedNotifications.length).toEqual(1);
        expect(interceptedNotifications[0].eventName).toEqual("myEvent");
        expect(interceptedNotifications[0].value).toEqual(123);
    });

    it('Should inherit any properties defined on ko.subscribable.fn', function() {
        this.after(function() {
            delete ko.subscribable.fn.customProp;
            delete ko.subscribable.fn.customFunc;
        });

        ko.subscribable.fn.customProp = 'some value';
        ko.subscribable.fn.customFunc = function() { return this; };

        var instance = new ko.subscribable();
        expect(instance.customProp).toEqual('some value');
        expect(instance.customFunc()).toEqual(instance);
    });

    it('Should have access to functions added to "fn" on existing instances on supported browsers', function () {
        // On unsupported browsers, there's nothing to test
        if (!jasmine.browserSupportsProtoAssignment) {
            return;
        }

        this.after(function() {
            delete ko.subscribable.fn.customFunction;
        });

        var subscribable = new ko.subscribable();

        var customFunction = function () {};

        ko.subscribable.fn.customFunction = customFunction;

        expect(subscribable.customFunction).toBe(customFunction);
    });

    it('Should delay change notifications if throttled', function() {
        jasmine.Clock.useMock();

        var subscribable = new ko.subscribable().extend({throttle:500});
        var notifySpy = jasmine.createSpy('notifySpy');
        subscribable.subscribe(notifySpy);
        subscribable.subscribe(notifySpy, null, 'custom');

        // "change" notification is delayed
        subscribable.notifySubscribers('a', "change");
        expect(notifySpy).not.toHaveBeenCalled();

        // Default notification is delayed
        subscribable.notifySubscribers('b');
        expect(notifySpy).not.toHaveBeenCalled();

        // Other notifications happen immediately
        subscribable.notifySubscribers('c', "custom");
        expect(notifySpy).toHaveBeenCalledWith('c');

        // Advance clock; Change notification happens now using the latest value notified
        jasmine.Clock.tick(501);
        expect(notifySpy).toHaveBeenCalledWith('b');
    });

    it('Should delay notifications if subscription is throttled', function() {
        jasmine.Clock.useMock();

        var subscribable = new ko.subscribable();
        // First subscription is throttled
        var notifySpy1 = jasmine.createSpy('notifySpy1');
        var subscription1 = subscribable.subscribe(notifySpy1, null, 'custom');
        ko.extenders.throttle(subscription1, 500);
        // Second isn't
        var notifySpy2 = jasmine.createSpy('notifySpy2');
        var subscription2 = subscribable.subscribe(notifySpy2, null, 'custom');

        subscribable.notifySubscribers('a', 'custom');
        expect(notifySpy1).not.toHaveBeenCalled();
        expect(notifySpy2).toHaveBeenCalledWith('a');

        subscribable.notifySubscribers('b', 'custom');
        expect(notifySpy1).not.toHaveBeenCalled();
        expect(notifySpy2).toHaveBeenCalledWith('b');

        // Advance clock; Notification happens now using the latest value notified
        notifySpy2.reset();
        jasmine.Clock.tick(501);
        expect(notifySpy1).toHaveBeenCalledWith('b');
        expect(notifySpy2).not.toHaveBeenCalled();
    });
});
