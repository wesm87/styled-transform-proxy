import { __, curry, compose, propIs, contains, keys, reduce, any, allPass, is } from 'ramda';

type GenericObject = { [key: string]: any };
type GenericFunction = (...args: any[]) => any;
type UnaryFn<I, R = I> = (input: I) => R;
type VariadicFn<R> = (...args: any[]) => R;

type ProxyFn = (strings: string[], ...interpolations: any[]) => any[];
type TemplateFn = (strings: string[], ...interpolations: any[]) => (string | GenericFunction)[];
type TemplateFactory = VariadicFn<TemplateFn>;

const TEMPLATE_FACTORY_FN_NAMES = ['attrs', 'withConfig'];

const isTemplateFactoryFnName = (fnName: string) => contains(fnName, TEMPLATE_FACTORY_FN_NAMES);

const isTemplateFactoryFnProp = (obj: GenericObject) => (key: string) => propIs(Function, key, obj);

const isTemplateFactoryFn = curry((val: GenericObject | GenericFunction, key: string) =>
  allPass([isTemplateFactoryFnName, isTemplateFactoryFnProp(val)])(key),
);

const hasAnyTemplateFactoryFn = (val: GenericObject | GenericFunction) =>
  compose(any(isTemplateFactoryFn(val)), keys)(val);

/**
 * Takes a transform function and a source function and returns a thunk that accepts any
 * number of args and returns the result of calling the transform function on the result
 * of the source function with the provided args.
 *
 * @signature (a -> b) -> (...* -> a) -> (...* -> b)
 */
const createThunkWith = curry(
  (transform: UnaryFn<any>, fn: VariadicFn<any>): VariadicFn<any> => (...args) =>
    transform(fn(...args)),
);

const proxy = curry(
  (proxyFn: ProxyFn, styledTemplateFn: TemplateFn): TemplateFn => {
    const proxiedTemplateFn = (strings: string[], ...interpolations: any[]) => {
      const [stringsResult, ...interpolationsResult] = proxyFn(strings, ...interpolations);

      return styledTemplateFn(stringsResult, ...interpolationsResult);
    };

    return proxiedTemplateFn;
  },
);

const makeProxiedTemplateFunction = curry(
  (proxyFn: ProxyFn, styledTemplateFn: TemplateFn): TemplateFn => {
    const templateFn = proxy(proxyFn, styledTemplateFn);

    TEMPLATE_FACTORY_FN_NAMES.forEach((fnName) => {
      const originalFn = styledTemplateFn[fnName];

      if (is(Function, originalFn)) {
        templateFn[fnName] = createThunkWith(makeProxiedTemplateFunction(proxyFn), originalFn);
      }
    });

    return templateFn;
  },
);

const makeProxiedTemplateFactory = curry(
  (proxyFn: ProxyFn, styled: TemplateFactory): TemplateFactory =>
    createThunkWith(makeProxiedTemplateFunction(proxyFn), styled),
);

const styledTransformProxy = curry((transformFn: GenericFunction, styled: any) => {
  const styledReducer = (acc: GenericFunction, key: string | number | symbol) => {
    const sourceValue = styled[key];

    if (is(Function, sourceValue) && hasAnyTemplateFactoryFn(sourceValue)) {
      acc[key] = makeProxiedTemplateFunction(transformFn, sourceValue);
    }

    return acc;
  };

  // styled(Component)
  const styledProxied = makeProxiedTemplateFactory(transformFn, styled);

  // styled.div, styled.span, etc.
  return reduce(styledReducer, styledProxied, keys(styled));
});

export default styledTransformProxy;
