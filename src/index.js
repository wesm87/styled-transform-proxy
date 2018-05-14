// @flow

import {
  __,
  curry,
  compose,
  propIs,
  contains,
  keys,
  reduce,
  any,
  allPass,
  is,
} from 'ramda'

type UnaryFn<I, R=I> = (I) => R;
type VariadicFn<R> = (...*) => R;

type ProxyFn = (Array<string>, ...*) => Array<*>;
type TemplateFn = (Array<string>, ...*) => Array<String | Function>;
type TemplateFactory = VariadicFn<TemplateFn>;

const TEMPLATE_FACTORY_FN_NAMES = ['attrs', 'withConfig']

const isTemplateFactoryFnName = contains(__, TEMPLATE_FACTORY_FN_NAMES)

const isTemplateFactoryFn = curry((val: Object | Function, key: string) =>
  allPass([
    isTemplateFactoryFnName,
    propIs(Function, __, val),
  ])(key)
)

const hasAnyTemplateFactoryFn = (val: Object | Function) =>
  compose(
    any(isTemplateFactoryFn(val)),
    keys,
  )(val)

/**
 * Takes a transform function and a source function and returns a thunk that accepts any
 * number of args and returns the result of calling the transform function on the result
 * of the source function with the provided args.
 *
 * @signature (a -> b) -> (...* -> a) -> (...* -> b)
 */
const createThunkWith = curry(
  (transform: UnaryFn<*>, fn: VariadicFn<*>): VariadicFn<*> =>
    (...args) =>
      transform(fn(...args))
)

const proxy = curry(
  (proxyFn: ProxyFn, styledTemplateFn: TemplateFn): TemplateFn => {
    const proxiedTemplateFn = (strings, ...interpolations) => {
      const proxiedTemplateFnResults = proxyFn(strings, ...interpolations)

      return styledTemplateFn(...proxiedTemplateFnResults)
    }

    return proxiedTemplateFn
  }
)

const makeProxiedTemplateFunction = curry(
  (proxyFn: ProxyFn, styledTemplateFn: TemplateFn): TemplateFn => {
    const templateFn = proxy(proxyFn, styledTemplateFn)

    TEMPLATE_FACTORY_FN_NAMES.forEach((fnName) => {
      const originalFn = styledTemplateFn[fnName]

      if (is(Function, originalFn)) {
        templateFn[fnName] = createThunkWith(
          makeProxiedTemplateFunction(proxyFn),
          originalFn,
        )
      }
    })

    return templateFn
  }
)

const makeProxiedTemplateFactory = curry(
  (proxyFn: ProxyFn, styled: TemplateFactory): TemplateFactory =>
    createThunkWith(makeProxiedTemplateFunction(proxyFn), styled)
)

const styledTransformProxy = curry(
  (transformFn: (...*) => *, styled: *) => {
    const styledReducer = (acc: Function, key: string) => {
      const sourceValue = styled[key]

      if (is(Function, sourceValue) && hasAnyTemplateFactoryFn(sourceValue)) {
        acc[key] = makeProxiedTemplateFunction(transformFn, sourceValue)
      }

      return acc
    }

    // styled(Component)
    const styledProxied = makeProxiedTemplateFactory(transformFn, styled)

    // styled.div, styled.span, etc.
    return reduce(styledReducer, styledProxied, keys(styled))
  }
)

export default styledTransformProxy
