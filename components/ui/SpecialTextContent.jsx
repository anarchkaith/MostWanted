import { Children, cloneElement, Fragment, isValidElement } from 'react';
import SpecialText from './SpecialText';

function animateText(child) {
  if (typeof child === 'string') {
    return child.trim() ? <SpecialText>{child}</SpecialText> : child;
  }
  if (typeof child === 'number') {
    return <SpecialText>{String(child)}</SpecialText>;
  }
  if (!isValidElement(child) || child.type === SpecialText) return child;
  if (child.props['aria-hidden'] === true) return child;
  if (child.type !== Fragment && typeof child.type !== 'string') return child;

  return cloneElement(child, {
    children: Children.map(child.props.children, animateText),
  });
}

export default function SpecialTextContent({ children }) {
  return Children.map(children, animateText);
}
