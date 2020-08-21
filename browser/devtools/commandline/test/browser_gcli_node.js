/*
 * Copyright 2012, Mozilla Foundation and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';
// <INJECTED SOURCE:START>

// THIS FILE IS GENERATED FROM SOURCE IN THE GCLI PROJECT
// DO NOT EDIT IT DIRECTLY

var exports = {};

var TEST_URI = "data:text/html;charset=utf-8,<p id='gcli-input'>gcli-testNode.js</p>";

function test() {
  return Task.spawn(function() {
    let options = yield helpers.openTab(TEST_URI);
    yield helpers.openToolbar(options);
    gcli.addItems(mockCommands.items);

    yield helpers.runTests(options, exports);

    gcli.removeItems(mockCommands.items);
    yield helpers.closeToolbar(options);
    yield helpers.closeTab(options);
  }).then(finish, helpers.handleError);
}

// <INJECTED SOURCE:END>

// var assert = require('../testharness/assert');
// var helpers = require('./helpers');
var nodetype = require('gcli/types/node');

exports.setup = function(options) {
  if (options.window) {
    nodetype.setDocument(options.window.document);
  }
};

exports.shutdown = function(options) {
  nodetype.unsetDocument();
};

exports.testNode = function(options) {
  return helpers.audit(options, [
    {
      skipRemainingIf: options.isNoDom,
      setup:    'tse ',
      check: {
        input:  'tse ',
        hints:      '<node> [options]',
        markup: 'VVVV',
        cursor: 4,
        current: 'node',
        status: 'ERROR',
        args: {
          command: { name: 'tse' },
          node: { status: 'INCOMPLETE' },
          nodes: { status: 'VALID' },
          nodes2: { status: 'VALID' }
        }
      }
    },
    {
      setup:    'tse :',
      check: {
        input:  'tse :',
        hints:       ' [options]',
        markup: 'VVVVE',
        cursor: 5,
        current: 'node',
        status: 'ERROR',
        args: {
          command: { name: 'tse' },
          node: {
            arg: ' :',
            status: 'ERROR',
            message: 'Syntax error in CSS query'
          },
          nodes: { status: 'VALID' },
          nodes2: { status: 'VALID' }
        }
      }
    },
    {
      setup:    'tse #',
      check: {
        input:  'tse #',
        hints:       ' [options]',
        markup: 'VVVVE',
        cursor: 5,
        current: 'node',
        status: 'ERROR',
        args: {
          command: { name: 'tse' },
          node: {
            value: undefined,
            arg: ' #',
            status: 'ERROR',
            message: 'Syntax error in CSS query'
          },
          nodes: { status: 'VALID' },
          nodes2: { status: 'VALID' }
        }
      }
    },
    {
      setup:    'tse .',
      check: {
        input:  'tse .',
        hints:       ' [options]',
        markup: 'VVVVE',
        cursor: 5,
        current: 'node',
        status: 'ERROR',
        args: {
          command: { name: 'tse' },
          node: {
            value: undefined,
            arg: ' .',
            status: 'ERROR',
            message: 'Syntax error in CSS query'
          },
          nodes: { status: 'VALID' },
          nodes2: { status: 'VALID' }
        }
      }
    },
    {
      setup:    'tse *',
      check: {
        input:  'tse *',
        hints:       ' [options]',
        markup: 'VVVVE',
        cursor: 5,
        current: 'node',
        status: 'ERROR',
        args: {
          command: { name: 'tse' },
          node: {
            value: undefined,
            arg: ' *',
            status: 'ERROR'
            // message: 'Too many matches (128)'
          },
          nodes: { status: 'VALID' },
          nodes2: { status: 'VALID' }
        }
      }
    }
  ]);
};

exports.testNodeDom = function(options) {
  var requisition = options.requisition;

  return helpers.audit(options, [
    {
      skipRemainingIf: options.isNoDom,
      setup:    'tse :root',
      check: {
        input:  'tse :root',
        hints:           ' [options]',
        markup: 'VVVVVVVVV',
        cursor: 9,
        current: 'node',
        status: 'VALID',
        args: {
          command: { name: 'tse' },
          node: { arg: ' :root', status: 'VALID' },
          nodes: { status: 'VALID' },
          nodes2: { status: 'VALID' }
        }
      }
    },
    {
      setup:    'tse :root ',
      check: {
        input:  'tse :root ',
        hints:            '[options]',
        markup: 'VVVVVVVVVV',
        cursor: 10,
        current: 'node',
        status: 'VALID',
        args: {
          command: { name: 'tse' },
          node: { arg: ' :root ', status: 'VALID' },
          nodes: { status: 'VALID' },
          nodes2: { status: 'VALID' }
        }
      },
      post: function() {
        assert.is(requisition.getAssignment('node').value.tagName,
                  'HTML',
                  'root id');
      }
    },
    {
      setup:    'tse #gcli-nomatch',
      check: {
        input:  'tse #gcli-nomatch',
        hints:                   ' [options]',
        markup: 'VVVVIIIIIIIIIIIII',
        cursor: 17,
        current: 'node',
        status: 'ERROR',
        args: {
          command: { name: 'tse' },
          node: {
            value: undefined,
            arg: ' #gcli-nomatch',
            status: 'INCOMPLETE',
            message: 'No matches'
          },
          nodes: { status: 'VALID' },
          nodes2: { status: 'VALID' }
        }
      }
    }
  ]);
};

exports.testNodes = function(options) {
  var requisition = options.requisition;

  return helpers.audit(options, [
    {
      skipRemainingIf: options.isNoDom,
      setup:    'tse :root --nodes *',
      check: {
        input:  'tse :root --nodes *',
        hints:                       ' [options]',
        markup: 'VVVVVVVVVVVVVVVVVVV',
        current: 'nodes',
        status: 'VALID',
        args: {
          command: { name: 'tse' },
          node: { arg: ' :root', status: 'VALID' },
          nodes: { arg: ' --nodes *', status: 'VALID' },
          nodes2: { status: 'VALID' }
        }
      },
      post: function() {
        assert.is(requisition.getAssignment('node').value.tagName,
                  'HTML',
                  '#gcli-input id');
      }
    },
    {
      setup:    'tse :root --nodes2 div',
      check: {
        input:  'tse :root --nodes2 div',
        hints:                       ' [options]',
        markup: 'VVVVVVVVVVVVVVVVVVVVVV',
        cursor: 22,
        current: 'nodes2',
        status: 'VALID',
        args: {
          command: { name: 'tse' },
          node: { arg: ' :root', status: 'VALID' },
          nodes: { status: 'VALID' },
          nodes2: { arg: ' --nodes2 div', status: 'VALID' }
        }
      },
      post: function() {
        assert.is(requisition.getAssignment('node').value.tagName,
                  'HTML',
                  'root id');
      }
    },
    {
      setup:    'tse --nodes ffff',
      check: {
        input:  'tse --nodes ffff',
        hints:                  ' <node> [options]',
        markup: 'VVVVIIIIIIIVIIII',
        cursor: 16,
        current: 'nodes',
        status: 'ERROR',
        args: {
          command: { name: 'tse' },
          node: {
            value: undefined,
            arg: '',
            status: 'INCOMPLETE'
          },
          nodes: {
            value: undefined,
            arg: ' --nodes ffff',
            status: 'INCOMPLETE',
            message: 'No matches'
          },
          nodes2: { arg: '', status: 'VALID', message: '' }
        }
      },
      post: function() {
        /*
        assert.is(requisition.getAssignment('nodes2').value.constructor.name,
                  'NodeList',
                  '#gcli-input id');
        */
      }
    },
    {
      setup:    'tse --nodes2 ffff',
      check: {
        input:  'tse --nodes2 ffff',
        hints:                   ' <node> [options]',
        markup: 'VVVVVVVVVVVVVVVVV',
        cursor: 17,
        current: 'nodes2',
        status: 'ERROR',
        args: {
          command: { name: 'tse' },
          node: {
            value: undefined,
            arg: '',
            status: 'INCOMPLETE'
          },
          nodes: { arg: '', status: 'VALID', message: '' },
          nodes2: { arg: ' --nodes2 ffff', status: 'VALID', message: '' }
        }
      },
      post: function() {
        /*
        assert.is(requisition.getAssignment('nodes').value.constructor.name,
                  'NodeList',
                  '#gcli-input id');
        assert.is(requisition.getAssignment('nodes2').value.constructor.name,
                  'NodeList',
                  '#gcli-input id');
        */
      }
    },
  ]);
};
