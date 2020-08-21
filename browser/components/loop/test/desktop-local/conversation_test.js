/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global loop, sinon, React, TestUtils */

var expect = chai.expect;

describe("loop.conversation", function() {
  "use strict";

  var ConversationRouter = loop.conversation.ConversationRouter,
      sandbox,
      notifier;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    sandbox.useFakeTimers();
    notifier = {
      notify: sandbox.spy(),
      warn: sandbox.spy(),
      warnL10n: sandbox.spy(),
      error: sandbox.spy(),
      errorL10n: sandbox.spy()
    };

    navigator.mozLoop = {
      doNotDisturb: true,
      get serverUrl() {
        return "http://example.com";
      },
      getStrings: function() {
        return JSON.stringify({textContent: "fakeText"});
      },
      get locale() {
        return "en-US";
      },
      setLoopCharPref: sandbox.stub(),
      getLoopCharPref: sandbox.stub(),
      getLoopBoolPref: sandbox.stub(),
      startAlerting: function() {},
      stopAlerting: function() {}
    };

    // XXX These stubs should be hoisted in a common file
    // Bug 1040968
    document.mozL10n.initialize(navigator.mozLoop);
  });

  afterEach(function() {
    delete window.navigator.mozLoop;
    sandbox.restore();
  });

  describe("#init", function() {
    var oldTitle;

    beforeEach(function() {
      oldTitle = document.title;

      sandbox.stub(document.mozL10n, "initialize");
      sandbox.stub(document.mozL10n, "get").returns("Fake title");

      sandbox.stub(loop.conversation.ConversationRouter.prototype,
        "initialize");
      sandbox.stub(loop.shared.models.ConversationModel.prototype,
        "initialize");
      sandbox.stub(loop.shared.views.NotificationListView.prototype,
        "initialize");

      sandbox.stub(Backbone.history, "start");
    });

    afterEach(function() {
      document.title = oldTitle;
    });

    it("should initalize L10n", function() {
      loop.conversation.init();

      sinon.assert.calledOnce(document.mozL10n.initialize);
      sinon.assert.calledWithExactly(document.mozL10n.initialize,
        window.navigator.mozLoop);
    });

    it("should set the document title", function() {
      loop.conversation.init();

      expect(document.title).to.be.equal("Fake title");
    });

    it("should create the router", function() {
      loop.conversation.init();

      sinon.assert.calledOnce(
        loop.conversation.ConversationRouter.prototype.initialize);
    });

    it("should start Backbone history", function() {
      loop.conversation.init();

      sinon.assert.calledOnce(Backbone.history.start);
    });
  });

  describe("ConversationRouter", function() {
    var conversation, client;

    beforeEach(function() {
      client = new loop.Client();
      conversation = new loop.shared.models.ConversationModel({}, {
        sdk: {},
        pendingCallTimeout: 1000,
      });
      sandbox.stub(client, "requestCallsInfo");
    });

    describe("Routes", function() {
      var router;

      beforeEach(function() {
        router = new ConversationRouter({
          client: client,
          conversation: conversation,
          notifier: notifier
        });
        sandbox.stub(router, "loadView");
        sandbox.stub(conversation, "incoming");
      });

      describe("#incoming", function() {

        // XXX refactor to Just Work with "sandbox.stubComponent" or else
        // just pass in the sandbox and put somewhere generally usable

        function stubComponent(obj, component, mockTagName){
          var reactClass = React.createClass({
            render: function() {
              var mockTagName = mockTagName || "div";
              return React.DOM[mockTagName](null, this.props.children);
            }
          });
          return sandbox.stub(obj, component, reactClass);
        }

        beforeEach(function() {
          sandbox.stub(router, "loadReactComponent");
          stubComponent(loop.conversation, "IncomingCallView");
        });

        it("should start alerting", function() {
          sandbox.stub(navigator.mozLoop, "startAlerting");
          router.incoming("fakeVersion");

          sinon.assert.calledOnce(navigator.mozLoop.startAlerting);
        });

        it("should set the loopVersion on the conversation model", function() {
          router.incoming("fakeVersion");

          expect(conversation.get("loopVersion")).to.equal("fakeVersion");
        });

        it("should call requestCallsInfo on the client",
          function() {
            router.incoming(42);

            sinon.assert.calledOnce(client.requestCallsInfo);
            sinon.assert.calledWith(client.requestCallsInfo, 42);
          });

        it("should display an error if requestCallsInfo returns an error",
          function(){
            client.requestCallsInfo.callsArgWith(1, "failed");

            router.incoming(42);

            sinon.assert.calledOnce(notifier.errorL10n);
          });

        describe("requestCallsInfo successful", function() {
          var fakeSessionData, resolvePromise, rejectPromise;

          beforeEach(function() {
            fakeSessionData  = {
              sessionId:      "sessionId",
              sessionToken:   "sessionToken",
              apiKey:         "apiKey",
              callId:         "Hello",
              progressURL:    "http://progress.example.com",
              websocketToken: 123
            };

            sandbox.stub(router, "_setupWebSocketAndCallView");
            sandbox.stub(conversation, "setSessionData");

            client.requestCallsInfo.callsArgWith(1, null, [fakeSessionData]);
          });

          it("should store the session data", function() {
            router.incoming("fakeVersion");

            sinon.assert.calledOnce(conversation.setSessionData);
            sinon.assert.calledWithExactly(conversation.setSessionData,
                                           fakeSessionData);
          });

          it("should call #_setupWebSocketAndCallView", function() {
            router.incoming("fakeVersion");

            sinon.assert.calledOnce(router._setupWebSocketAndCallView);
            sinon.assert.calledWithExactly(router._setupWebSocketAndCallView);
          });
        });

        describe("#_setupWebSocketAndCallView", function() {
          beforeEach(function() {
            conversation.setSessionData({
              sessionId:      "sessionId",
              sessionToken:   "sessionToken",
              apiKey:         "apiKey",
              callId:         "Hello",
              progressURL:    "http://progress.example.com",
              websocketToken: 123
            });
          });

          describe("Websocket connection successful", function() {
            var promise;

            beforeEach(function() {
              sandbox.stub(loop, "CallConnectionWebSocket").returns({
                promiseConnect: function() {
                  promise = new Promise(function(resolve, reject) {
                    resolve();
                  });
                  return promise;
                }
              });
            });

            it("should create a CallConnectionWebSocket", function(done) {
              router._setupWebSocketAndCallView();

              promise.then(function () {
                sinon.assert.calledOnce(loop.CallConnectionWebSocket);
                sinon.assert.calledWithExactly(loop.CallConnectionWebSocket, {
                  callId: "Hello",
                  url: "http://progress.example.com",
                  // The websocket token is converted to a hex string.
                  websocketToken: "7b"
                });
                done();
              });
            });

            it("should display the incoming call view", function(done) {
              router._setupWebSocketAndCallView();

              promise.then(function () {
              sinon.assert.calledOnce(loop.conversation.IncomingCallView);
              sinon.assert.calledWithExactly(loop.conversation.IncomingCallView,
                                            {model: conversation});
              sinon.assert.calledOnce(router.loadReactComponent);
              sinon.assert.calledWith(router.loadReactComponent,
              sinon.match(function(value) {
                return TestUtils.isComponentOfType(value,
                  loop.conversation.IncomingCallView);
              }));
              done();
            });
            });
          });

          describe("Websocket connection failed", function() {
            var promise;

            beforeEach(function() {
              sandbox.stub(loop, "CallConnectionWebSocket").returns({
                promiseConnect: function() {
                  promise = new Promise(function(resolve, reject) {
                    reject();
                  });
                  return promise;
                }
              });
            });

            it("should display an error", function(done) {
              router._setupWebSocketAndCallView();

              promise.then(function() {
              }, function () {
                sinon.assert.calledOnce(router._notifier.errorL10n);
                sinon.assert.calledWithExactly(router._notifier.errorL10n,
                  "cannot_start_call_session_not_ready");
                done();
              });
            });
          });
        });
      });

      describe("#accept", function() {
        beforeEach(function() {
          conversation.setSessionData({
            sessionId:      "sessionId",
            sessionToken:   "sessionToken",
            apiKey:         "apiKey",
            callId:         "Hello",
            progressURL:    "http://progress.example.com",
            websocketToken: 123
          });
          router._setupWebSocketAndCallView();

          sandbox.stub(router._websocket, "accept");
          sandbox.stub(navigator.mozLoop, "stopAlerting");
        });

        it("should initiate the conversation", function() {
          router.accept();

          sinon.assert.calledOnce(conversation.incoming);
        });

        it("should notify the websocket of the user acceptance", function() {
          router.accept();

          sinon.assert.calledOnce(router._websocket.accept);
        });

        it("should stop alerting", function() {
          router.accept();

          sinon.assert.calledOnce(window.navigator.mozLoop.stopAlerting);
        });
      });

      describe("#conversation", function() {
        beforeEach(function() {
          sandbox.stub(router, "loadReactComponent");
        });

        it("should load the ConversationView if session is set", function() {
          conversation.set("sessionId", "fakeSessionId");

          router.conversation();

          sinon.assert.calledOnce(router.loadReactComponent);
          sinon.assert.calledWith(router.loadReactComponent,
            sinon.match(function(value) {
              return TestUtils.isComponentOfType(value,
                loop.shared.views.ConversationView);
            }));
        });

        it("should not load the ConversationView if session is not set",
          function() {
            router.conversation();

            sinon.assert.notCalled(router.loadReactComponent);
        });

        it("should notify the user when session is not set",
          function() {
            router.conversation();

            sinon.assert.calledOnce(router._notifier.errorL10n);
            sinon.assert.calledWithExactly(router._notifier.errorL10n,
              "cannot_start_call_session_not_ready");
        });
      });

      describe("#decline", function() {
        beforeEach(function() {
          sandbox.stub(window, "close");
          router._websocket = {
            decline: sandbox.spy()
          };
        });

        it("should close the window", function() {
          router.decline();
          sandbox.clock.tick(1);

          sinon.assert.calledOnce(window.close);
        });

        it("should stop alerting", function() {
          sandbox.stub(window.navigator.mozLoop, "stopAlerting");
          router.decline();

          sinon.assert.calledOnce(window.navigator.mozLoop.stopAlerting);
        });
      });

      describe("#ended", function() {
        // XXX When the call is ended gracefully, we should check that we
        // close connections nicely
        it("should close the window");
      });
    });

    describe("Events", function() {
      var router, fakeSessionData;

      beforeEach(function() {
        fakeSessionData = {
          sessionId:    "sessionId",
          sessionToken: "sessionToken",
          apiKey:       "apiKey"
        };
        sandbox.stub(loop.conversation.ConversationRouter.prototype,
                     "navigate");
        conversation.set("loopToken", "fakeToken");
        router = new loop.conversation.ConversationRouter({
          client: client,
          conversation: conversation,
          notifier: notifier
        });
      });

      it("should navigate to call/ongoing once the call is ready",
        function() {
          router.incoming(42);

          conversation.incoming();

          sinon.assert.calledOnce(router.navigate);
          sinon.assert.calledWith(router.navigate, "call/ongoing");
        });

      it("should navigate to call/ended when the call session ends",
        function() {
          conversation.trigger("session:ended");

          sinon.assert.calledOnce(router.navigate);
          sinon.assert.calledWith(router.navigate, "call/ended");
        });

      it("should navigate to call/ended when peer hangs up", function() {
        conversation.trigger("session:peer-hungup");

        sinon.assert.calledOnce(router.navigate);
        sinon.assert.calledWith(router.navigate, "call/ended");
      });

      it("should navigate to call/{token} when network disconnects",
        function() {
          conversation.trigger("session:network-disconnected");

          sinon.assert.calledOnce(router.navigate);
          sinon.assert.calledWith(router.navigate, "call/ended");
        });

      describe("Published and Subscribed Streams", function() {
        beforeEach(function() {
          router._websocket = {
            mediaUp: sinon.spy()
          };
          router.incoming("fakeVersion");
        });

        describe("publishStream", function() {
          it("should not notify the websocket if only one stream is up",
            function() {
              conversation.set("publishedStream", true);

              sinon.assert.notCalled(router._websocket.mediaUp);
            });

          it("should notify the websocket that media is up if both streams" +
             "are connected", function() {
              conversation.set("subscribedStream", true);
              conversation.set("publishedStream", true);

              sinon.assert.calledOnce(router._websocket.mediaUp);
            });
        });

        describe("subscribedStream", function() {
          it("should not notify the websocket if only one stream is up",
            function() {
              conversation.set("subscribedStream", true);

              sinon.assert.notCalled(router._websocket.mediaUp);
            });

          it("should notify the websocket that media is up if both streams" +
             "are connected", function() {
              conversation.set("publishedStream", true);
              conversation.set("subscribedStream", true);

              sinon.assert.calledOnce(router._websocket.mediaUp);
            });
        });
      });
    });
  });

  describe("EndedCallView", function() {
    describe("#closeWindow", function() {
      it("should close the conversation window", function() {
        sandbox.stub(window, "close");
        var view = new loop.conversation.EndedCallView();

        view.closeWindow({preventDefault: sandbox.spy()});

        sinon.assert.calledOnce(window.close);
      });
    });
  });

  describe("IncomingCallView", function() {
    var view, model;

    beforeEach(function() {
      var Model = Backbone.Model.extend({});
      model = new Model();
      sandbox.spy(model, "trigger");
      view = TestUtils.renderIntoDocument(loop.conversation.IncomingCallView({
        model: model
      }));
    });

    describe("click event on .btn-accept", function() {
      it("should trigger an 'accept' conversation model event", function() {
        var buttonAccept = view.getDOMNode().querySelector(".btn-accept");

        TestUtils.Simulate.click(buttonAccept);

        sinon.assert.calledOnce(model.trigger);
        sinon.assert.calledWith(model.trigger, "accept");
        });
    });

    describe("click event on .btn-decline", function() {
      it("should trigger an 'decline' conversation model event", function() {
        var buttonDecline = view.getDOMNode().querySelector(".btn-decline");

        TestUtils.Simulate.click(buttonDecline);

        sinon.assert.calledOnce(model.trigger);
        sinon.assert.calledWith(model.trigger, "decline");
        });
    });
  });
});
