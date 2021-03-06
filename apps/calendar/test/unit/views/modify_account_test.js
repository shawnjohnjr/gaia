requireApp('calendar/test/unit/helper.js', function() {
  requireApp('calendar/js/templates/account.js');
  requireApp('calendar/js/presets.js');
  requireApp('calendar/js/provider/local.js');
  requireApp('calendar/js/models/account.js');
  requireApp('calendar/js/views/modify_account.js');
});

suite('views/modify_account', function() {

  var subject;
  var account;
  var triggerEvent;
  var app;

  suiteSetup(function() {
    triggerEvent = testSupport.calendar.triggerEvent;
  });

  function hasClass(value) {
    return subject.element.classList.contains(value);
  }

  function getField(name) {
    return subject.fields[name];
  }

  function fieldValue(name) {
    var field = getField(name);
    return field.value;
  }

  teardown(function() {
    var el = document.getElementById('test');
    el.parentNode.removeChild(el);
  });

  setup(function() {
    var div = document.createElement('div');
    div.id = 'test';
    div.innerHTML = [
      '<div id="modify-account-view">',
        '<button class="save">save</button>',
        '<button class="cancel">cancel</button>',
        '<button class="delete-cancel">cancel</button>',
        '<div class="errors"></div>',
        '<form>',
          '<input name="user" />',
          '<input name="password" />',
          '<input name="fullUrl" />',
        '</form>',
        '<button class="delete-confirm">',
      '</div>'
    ].join('');

    document.body.appendChild(div);

    app = testSupport.calendar.app();

    account = Factory('account');

    subject = new Calendar.Views.ModifyAccount({
      app: app,
      model: account
    });
  });

  suite('initialization', function() {

    test('when given correct fields', function() {
      var subject = new Calendar.Views.ModifyAccount({
        model: account,
        type: 'new'
      });
    });

  });

  test('#deleteButton', function() {
    assert.ok(subject.deleteButton);
  });

  test('#saveButton', function() {
    assert.ok(subject.saveButton);
  });

  test('#errors', function() {
    assert.ok(subject.errors);
  });

  test('#form', function() {
    assert.ok(subject.form);
  });

  test('#fields', function() {
    var result = subject.fields;

    function hasName(field) {
      var value = result[field].getAttribute('name');
      assert.equal(value, field);
    }

    hasName('user');
    hasName('password');
    hasName('fullUrl');
  });

  suite('#_persistForm', function() {
    var calledSetup;
    var calledPersist;

    var store = {
      // mock out persist
      // we are not trying to
      // test db functionality here.
      verifyAndPersist: function(obj, callback) {
        calledPersist = arguments;
        setTimeout(function() {
          callback(null, obj);
        }, 0);
      }
    };

    setup(function() {
      calledPersist = null;
      // mock out account store
      app.db._stores.Account = store;
    });

    suite('success', function() {

      test('result', function(done) {
        getField('user').value = 'user';
        getField('password').value = 'pass';

        subject._persistForm(function() {
          done(function() {
            assert.equal(calledPersist[0], subject.model);

            var model = subject.model;

            assert.equal(model.user, 'user');
            assert.equal(model.password, 'pass');
          });
        });
      });
    });
  });

  suite('#deleteRecord', function() {
    var calledShow;
    var calledRemove;

    setup(function() {

      var store = app.store('Account');
      // we don't really need to redirect
      // in the test just confirm that it does
      app.router.show = function() {
        calledShow = arguments;
      }

      // again fake model so we do a fake remove
      store.remove = function() {
        calledRemove = arguments;
      };
    });

    test('with existing model', function() {
      // assign model to simulate
      // a record that has been dispatched
      var model = Factory('account');
      model._id = 'myaccount';
      subject.model = model;
      subject.render();

      triggerEvent(subject.deleteButton, 'click');

      assert.ok(!calledShow, 'did not redirect before-removal');
      assert.ok(calledRemove, 'called remove');
      assert.equal(calledRemove[0], model._id, 'removes right id');

      var removeCb = calledRemove[calledRemove.length - 1];

      removeCb();

      assert.deepEqual(
        calledShow,
        ['/advanced-settings/']
      );
    });
  });

  suite('#save', function() {

    var calledWith;

    setup(function() {
      calledWith = null;
      subject.completeUrl = '/settings';
    });

    test('on success', function(done) {
      subject._persistForm = function(callback) {
        setTimeout(function() {
          callback(null, true);
          done(function() {
            assert.equal(Calendar.Test.FakePage.shown, subject.completeUrl);
            assert.isFalse(hasClass(subject.progressClass));
          });
        }, 0);
      }

      subject.save();
      assert.isTrue(hasClass(subject.progressClass));
    });

    test('on failure', function(done) {
      subject._persistForm = function(callback) {
        setTimeout(function() {
          callback(new Error('ouch'));
          done(function() {
            assert.ok(!calledWith);
            assert.isFalse(hasClass(subject.progressClass));
          });
        }, 0);
      }

      subject.save();
      assert.isTrue(hasClass(subject.progressClass));
    });

  });

  test('#_clearErrors', function() {
    subject.errors.textContent = 'foo';

    subject._clearErrors();

    assert.equal(subject.errors.textContent, '');
  });

  test('#_displayError', function() {
    subject.errors.textContent = '';
    subject._displayError(new Error('foo'));
    assert.equal(subject.errors.textContent, 'foo');
  });

  test('#_createModel', function() {
    var preset = 'local';

    subject.model = null;

    var model = subject._createModel(preset);

    assert.instanceOf(model, Calendar.Models.Account);

    assert.equal(
      model.providerType,
      Calendar.Presets.local.providerType
    );
  });

  test('#_updateModel', function() {
    var model = new Calendar.Models.Account();
    var store = app.store('Account');
    store._cached['1'] = model;

    var data = subject._updateModel('1');

    assert.equal(model, data);
  });

  test('#updateForm', function() {
    account.user = 'james';
    //we never display the password.
    account.password = 'baz';
    account.fullUrl = 'http://google.com/path/';

    subject.updateForm();

    var fields = subject.fields;

    assert.equal(fieldValue('user'), 'james');
    assert.equal(fieldValue('password'), '');
    assert.equal(fieldValue('fullUrl'), 'http://google.com/path/');
  });

  test('#updateModel', function() {
    var fields = subject.fields;
    fields.user.value = 'user';
    fields.password.value = 'pass';
    fields.fullUrl.value = 'http://google.com/foo/';

    subject.updateModel();

    assert.equal(account.user, 'user');
    assert.equal(account.password, 'pass');
    assert.equal(account.fullUrl, 'http://google.com/foo/');
  });

  suite('#dispatch', function() {
    var rendered;
    var model;

    setup(function() {
      rendered = false;
      model = {};
      subject.render = function() {
        rendered = true;
      };
    });

    suite('provider no creds', function() {
      var calledSave;
      var model;

      setup(function() {
        calledSave = false;

        subject.save = function() {
          calledSave = true;
        }

        model = new Calendar.Models.Account({
          providerType: 'Local'
        });


        subject._createModel = function() {
          return model;
        }
      });

      test('result', function() {
        subject.dispatch({ params: { preset: 'local'} });
        assert.isTrue(calledSave);
      });

    });

    test('new', function() {
      var calledWith;
      subject._createModel = function() {
        calledWith = arguments;
        return model;
      }

      subject.dispatch({
        params: { preset: 'local' }
      });

      assert.equal(subject.completeUrl, '/settings/');
      assert.equal(calledWith[0], 'local');
      assert.equal(subject.model, model);
      assert.ok(rendered);
    });

    test('existing', function() {
      var calledWith;
      var destroyed;

      subject.model = {};
      subject.destroy = function() {
        destroyed = true;
      }

      subject._updateModel = function() {
        calledWith = arguments;
        return model;
      }

      subject.dispatch({
        params: { id: '1' }
      });

      assert.ok(destroyed, 'should destroy previous state');
      assert.equal(subject.completeUrl, '/settings/');
      assert.equal(calledWith[0], '1');
      assert.equal(subject.model, model);
      assert.ok(rendered);
    });

  });

  suite('#render', function() {

    setup(function() {
      account.user = 'foo';
      subject.fields.password.value = 'foo';
      subject.render();
    });

    test('save button', function() {
      var called;

      subject._persistForm = function() {
        called = true;
      }

      triggerEvent(subject.saveButton, 'click');
      assert.ok(called);
    });

    test('type', function(done) {
      assert.ok(subject.type);
      done();
    });

    test('update', function(done) {
      assert.equal(subject.fields.user.value, 'foo');
      done();
    });

    test('clear password', function() {
      assert.equal(subject.fields.password.value, '');
    });

    test('type class', function() {
      assert.isTrue(hasClass(subject.type));
      assert.isTrue(hasClass('preset-' + account.preset));
      assert.isTrue(hasClass('provider-' + account.providerType));
    });
  });

  suite('#destroy', function() {
    setup(function() {
      subject.render();
      subject.destroy();
    });

    test('save button', function() {
      var called;

      subject._persistForm = function() {
        called = true;
      }

      triggerEvent(subject.saveButton, 'click');
      assert.ok(!called);
    });

    test('fields', function() {
      assert.equal(subject._fields, null);
    });

    test('type class', function() {
      assert.isFalse(hasClass(subject.type));
      assert.isFalse(hasClass('preset-' + account.preset));
      assert.isFalse(hasClass('provider-' + account.providerType));
    });

  });

});
