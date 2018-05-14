# styled-transform-proxy

A wrapper function for extending styled-components via a custom transform function. The
wrapper function is curried and takes two arguments - the transform function and the
original `styled` function from `styled-components`. The transform receives the original
strings & interpolations and is expected to return an array containing the strings and
interpolations with any transformations applied.

## Install

```sh
# Yarn
yarn add styled-transform-proxy

# npm
npm install --save styled-transform-proxy
```

## Type Definitions

```
transform :: (Array<String> strings, ...* interpolations) -> [strings, ...interpolations]

styledTransformProxy :: transform -> styled -> styled
```

## Examples

### Transform strings

```js
// src/styled.js
import styled from 'styled-components';
import styledTransformProxy from 'styled-transform-proxy';
import { map, replace } from 'ramda';

const transformStrings = map(replace(/\.foo\s/g, '.bar '));

const transform = (strings, ...interpolations) => [
  transformStrings([...strings]),
  ...interpolations
];

export default styledTransformProxy(transform, styled);

// src/components/MyComponent.js
import styled from '../styled';

// Results in `.foo` below being transformed to `.bar`
const MyComponent = styled.span`
  .foo {
    color: red;
  }
`;
```

### Transform interpolations

```js
// src/styled.js
import styled from 'styled-components';
import styledTransformProxy from 'styled-transform-proxy';
import { map, path, when, is } from 'ramda';

const transformInterpolations = map(when(is(Array), path));

const transform = (strings, ...interpolations) => [
  strings,
  ...transformInterpolations(interpolations),
];

export default styledTransformProxy(transform, styled);

// src/components/MyComponent.js
import styled from '../styled';

const MyComponent = styled.span`
  color: ${['colors', 'foreground']};
  background-color: ${['colors', 'background']}
`;

// The above is equivalent to:
const MyComponent = styled.span`
  color: ${(props) => props.colors.foreground};
  background-color: ${(props) => props.colors.background};
`;
```

### Composing transforms

The wrapper function being curried means that composing multiple transformations together
is simple:

```js
// src/styled.js
import styled from 'styled-components';
import styledTransformProxy from 'styled-transform-proxy';
import { compose } from 'ramda';

const transformFoo = (strings, ...interpolations) => [...];
const transformBar = (strings, ...interpolations) => [...];

const applyTransforms = compose(
  styledTransformProxy(transformFoo),
  styledTransformProxy(transformBar),
);

export default applyTransforms(styled);
```

### Third-party libraries

If you're creating a third-party package that utilizes `styled-transform-proxy` you can simplify things a bit compared to the above examples. In addition to the wrapper function being curried, it takes the original `styled` function as its last argument, meaning instead of this:

```js
export default (styled) => styledTransformProxy(transform, styled);
```

...you can simply do this:

```js
export default styledTransformProxy(transform);
```

## Caveats

Currently there is no straightforward way to tap into the `extend` method on a styled
component, so the transform function will not be applied when using `extend`. So instead
of this:

```js
const ChildComponent = ParentComponent.extend`...`;
```

...you'll need to do this:

```js
const ChildComponent = styled(ParentComponent)`...`;
```
