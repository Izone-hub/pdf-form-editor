type MapWithUpsert<K, V> = Map<K, V> & {
  getOrInsert?: (key: K, value: V) => V
  getOrInsertComputed?: (key: K, initializer: (key: K) => V) => V
}

type WeakMapWithUpsert<K extends object, V> = WeakMap<K, V> & {
  getOrInsert?: (key: K, value: V) => V
  getOrInsertComputed?: (key: K, initializer: (key: K) => V) => V
}

function ensureMapUpsertPolyfills() {
  const proto = Map.prototype as MapWithUpsert<unknown, unknown>
  if (!proto.getOrInsert) {
    Object.defineProperty(proto, 'getOrInsert', {
      value: function <K, V>(this: Map<K, V>, key: K, value: V) {
        if (!this.has(key)) this.set(key, value)
        return this.get(key) as V
      },
      configurable: true,
      writable: true,
    })
  }
  if (!proto.getOrInsertComputed) {
    Object.defineProperty(proto, 'getOrInsertComputed', {
      value: function <K, V>(this: Map<K, V>, key: K, initializer: (key: K) => V) {
        if (!this.has(key)) this.set(key, initializer(key))
        return this.get(key) as V
      },
      configurable: true,
      writable: true,
    })
  }
}

function ensureWeakMapUpsertPolyfills() {
  const proto = WeakMap.prototype as WeakMapWithUpsert<object, unknown>
  if (!proto.getOrInsert) {
    Object.defineProperty(proto, 'getOrInsert', {
      value: function <K extends object, V>(this: WeakMap<K, V>, key: K, value: V) {
        if (!this.has(key)) this.set(key, value)
        return this.get(key) as V
      },
      configurable: true,
      writable: true,
    })
  }
  if (!proto.getOrInsertComputed) {
    Object.defineProperty(proto, 'getOrInsertComputed', {
      value: function <K extends object, V>(
        this: WeakMap<K, V>,
        key: K,
        initializer: (key: K) => V,
      ) {
        if (!this.has(key)) this.set(key, initializer(key))
        return this.get(key) as V
      },
      configurable: true,
      writable: true,
    })
  }
}

ensureMapUpsertPolyfills()
ensureWeakMapUpsertPolyfills()
