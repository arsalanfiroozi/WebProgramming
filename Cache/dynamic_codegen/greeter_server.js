import { Mutex, Semaphore, withTimeout } from 'async-mutex';

const mutex = new Mutex();

var PROTO_PATH = './../protos/cache.proto';

import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
var packageDefinition = protoLoader.loadSync(
  PROTO_PATH,
  {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });
var cache = grpc.loadPackageDefinition(packageDefinition).cache;


const N_Max = 3; // Cache Storage
let N = 0;

class ListNode {
  constructor(key, data) {
    this.key = key;
    this.data = data;
    this.next = -1;
    this.parent = -1;
  }
}
let list = -1; // First Node
let last = -1; // Last Node ==> LRU
let map = {};

let id = 1;

function showLinkList() {
  let t = list;
  let i = 1;
  while (t != -1) {
    // if (t.parent != -1)
    //   console.log(i + ': ' + t.data + ', Parent:' + t.parent.data);
    // else
    //   console.log(i + ': ' + t.data);
    // i = i + 1;
    console.log(t);
    t = t.next;
  }
}

function GetKey(call, callback, op = 0) {
  mutex.runExclusive(async () => {
    let { key, value } = call.request;
    let message = 'Not found!';

    if (map[key] != undefined) {
      message = map[key].data;
      if (map[key].next != -1 && map[key].parent != -1) {
        console.log('qq2');
        map[key].next.parent = map[key].parent;
        map[key].parent.next = map[key].next;
        map[key].parent = -1;
        map[key].next = list;
        list.parent = map[key];
        list = map[key];
      } else if (map[key].next == -1 && map[key].parent != -1) {
        console.log('qq2');
        map[key].parent.next = -1;
        last = map[key].parent;
        map[key].parent = -1;
        map[key].next = list;
        list.parent = map[key];
        list = map[key];
        if (last.parent == -1) {
          last.parent = list;
        }
      } else if (map[key].next == -1 && map[key].parent == -1) {
        last = map[key];
      }
    }
    console.log('Linked List:')
    console.log(showLinkList())
    console.log('Last:')
    console.log(last)
    console.log('----------------------------' + id)
    callback(null, { message: message });
  });
}

function SetKey(call, callback) {
  mutex.runExclusive(async () => {
    // console.log('Linked List:')
    // console.log(showLinkList())
    let { key, value } = call.request;
    let message = 'Ok';
    let flag = 0;
    if (map[key] != undefined) {
      console.log('Exist')
      map[key].value = value;
      if (map[key].next != -1 && map[key].parent != -1) {
        console.log('qq2');
        map[key].next.parent = map[key].parent;
        map[key].parent.next = map[key].next;
        map[key].parent = -1;
        map[key].next = list;
        list.parent = map[key];
        list = map[key];
      } else if (map[key].next == -1 && map[key].parent != -1) {
        console.log('qq2');
        map[key].parent.next = -1;
        last = map[key].parent;
        map[key].parent = -1;
        map[key].next = list;
        list.parent = map[key];
        list = map[key];
        if (last.parent == -1) {
          last.parent = list;
        }
      } else if (map[key].next == -1 && map[key].parent == -1) {
        last = map[key];
      }
    } else {
      if (N == N_Max) {
        map[last.key] = undefined;
        last.parent.next = -1;
        last = last.parent;
      } else {
        N = N + 1;
      }
      let t = new ListNode(key, value);
      t.next = list;
      if (last == -1) {
        last = t;
      }
      map[key] = t;
      if (list != -1)
        list.parent = t;
      list = t;
    }
    callback(null, { message: message });
    console.log('Linked List:')
    console.log(showLinkList())
    console.log('Last:')
    console.log(last)
    console.log('----------------------------' + id)
    id = id + 1;
  });
}

function Clear(call, callback) {
  mutex.runExclusive(async () => {
    list = -1;
    callback(null, { message: 'Ok' });
  });
}

/**
 * Starts an RPC server that receives requests for the Greeter service at the
 * sample server port
 */
function main() {
  var server = new grpc.Server();
  server.addService(cache.Greeter.service, { Clear: Clear, SetKey: SetKey, GetKey: GetKey });
  server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), () => {
    server.start();
  });
}

main();