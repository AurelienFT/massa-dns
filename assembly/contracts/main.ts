// The entry file of your WebAssembly module.
import { Address, Context, Storage, call, callerHasWriteAccess, generateEvent, transferCoins } from '@massalabs/massa-as-sdk';
import { Amount, Args, Result, bytesToString, stringToBytes } from '@massalabs/as-types';

/**
 * This function is meant to be called only one time: when the contract is deployed.
 *
 * @param binaryArgs - Arguments serialized with Args
 */
export function constructor(_: StaticArray<u8>): StaticArray<u8> {
  // This line is important. It ensures that this function can't be called in the future.
  // If you remove this check, someone could call your constructor function and reset your smart contract.
  if (!callerHasWriteAccess()) {
    return [];
  }
  return [];
}

const ONE_UNIT = 1_000_000_000;

//TODO: Learn how to return result for sub calls
//TODO: Improve error messages

function serializeResult<T>(result: Result<T>): StaticArray<u8> {
  let args = new Args();
  if (result.isOk()) {
    args.add<u8>(0);
    args.add<T>(result.unwrap());
  } else {
    args.add<u8>(1);
    args.add<string>(result.error!);
  }
  return args.serialize();
}

export function dns_resolve(args: StaticArray<u8>): StaticArray<u8> {
  let args_decoded = new Args(args);
  let full_domain = args_decoded.nextString().unwrap();
  let domain_array = split_domain(full_domain);
  if (domain_array[0] != "") {
    let address = Storage.get(domain_array[1]);
    let args = new Args();
    args.add(domain_array[0]);
    return call(new Address(address), "dns_resolve", args, Context.transferredCoins());
  } else {
    return serializeResult<string>(new Result(Storage.get(domain_array[1])));
  }
}

function compute_cost(domain: string): Amount {
  if (domain.length == 2) {
    return new Amount(10000 * ONE_UNIT);
  } else if (domain.length == 3) {
    return new Amount(1000 * ONE_UNIT);
  } else if (domain.length >= 4 && domain.length <= 10) {
    return new Amount(100 * ONE_UNIT);
  } else {
    return new Amount(1 * ONE_UNIT);
  }
}

function is_valid_domain(domain: string): bool {
  if (domain.length < 2) {
    return false;
  }
  for (let i = 0; i < domain.length; i++) {
    let c = domain.charCodeAt(i);
    if (!((c >= 48 && c <= 57) || (c >= 97 && c <= 122) || c == 45)) {
      return false;
    }
  }
  return true;
}

function split_domain(domain: string): StaticArray<string> {
  let lastIndex = domain.lastIndexOf(".");
  if (lastIndex == -1) {
    return ["", domain];
  } else {
    let parts = new StaticArray<string>(2);
    parts[0] = domain.slice(0, lastIndex);
    parts[1] = domain.slice(lastIndex + 1);
    return parts;
  }
}

export function dns_alloc_cost(args: StaticArray<u8>): StaticArray<u8> {
  let args_decoded = new Args(args);
  let full_domain = args_decoded.nextString().unwrap();
  let address = new Address(args_decoded.nextString().unwrap());
  let domain_array = split_domain(full_domain);
  let cost = new Amount(0);
  //TODO: Add storage cost
  if (domain_array[0] != "") {
    let address = Storage.get(domain_array[1]);
    let args = new Args();
    args.add(domain_array[0]);
    return call(new Address(address), "dns_alloc_cost", args, Context.transferredCoins());
  }
  cost = cost.add(compute_cost(domain_array[1])).unwrap();
  if (!is_valid_domain(domain_array[1])) {
    return serializeResult<Amount>(new Result(new Amount(0), "Invalid domain name."));
  }
  return serializeResult<Amount>(new Result(cost));
}

export function dns_alloc(args: StaticArray<u8>): StaticArray<u8> {
  let args_decoded = new Args(args);
  let full_domain = args_decoded.nextString().unwrap();
  let address = new Address(args_decoded.nextString().unwrap());
  let domain_array = split_domain(full_domain);
  if (domain_array[0] != "") {
    let address = Storage.get(domain_array[1]);
    let args = new Args();
    args.add(domain_array[0]);
    return call(new Address(address), "dns_alloc", args, Context.transferredCoins());
  } else {
    let cost = compute_cost(domain_array[1]);
    if (Context.transferredCoins() < cost.value) {
      return serializeResult<StaticArray<u8>>(new Result(new StaticArray<u8>(0), "Not enough coins to pay for the domain name."));
    }
    Storage.set(domain_array[1], address.toString());
    return serializeResult<StaticArray<u8>>(new Result(new StaticArray<u8>(0)));
  }
}

export function dns_free(args: StaticArray<u8>): StaticArray<u8> {
  let args_decoded = new Args(args);
  let full_domain = args_decoded.nextString().unwrap();
  let domain_array = split_domain(full_domain);
  if (domain_array[0] != "") {
    let address = Storage.get(domain_array[1]);
    let args = new Args();
    args.add(domain_array[0]);
    return call(new Address(address), "dns_free", args, Context.transferredCoins());
  } else {
    let address = Storage.get(domain_array[1]);
    if (address != Context.caller().toString()) {
      return serializeResult<StaticArray<u8>>(new Result(new StaticArray<u8>(0), "Only the owner of the domain can free it."));
    }
    Storage.del(domain_array[1]);
    let cost = compute_cost(domain_array[1]);
    transferCoins(Context.caller(), cost.value / 2);
    return serializeResult<StaticArray<u8>>(new Result(new StaticArray<u8>(0)));
  }
}

export function dns_transfer(args: StaticArray<u8>): StaticArray<u8> {
  let args_decoded = new Args(args);
  let full_domain = args_decoded.nextString().unwrap();
  let new_addr = new Address(args_decoded.nextString().unwrap());
  let domain_array = split_domain(full_domain);
  if (domain_array[0] != "") {
    let address = Storage.get(domain_array[1]);
    let args = new Args();
    args.add(domain_array[0]);
    return call(new Address(address), "dns_transfer", args, Context.transferredCoins());
  } else {
    let address = Storage.get(domain_array[1]);
    if (address != Context.caller().toString()) {
      return serializeResult<StaticArray<u8>>(new Result(new StaticArray<u8>(0), "Only the owner of the domain can free it."));
    }
    Storage.set(domain_array[1], new_addr.toString());
    return serializeResult<StaticArray<u8>>(new Result(new StaticArray<u8>(0)));
  }
}
