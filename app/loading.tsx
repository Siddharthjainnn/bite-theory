import FoodLoader from './components/FoodLoader';

/** Global route-transition loader — Next.js shows this automatically
 *  while any page's server component / data is loading. */
export default function Loading() {
  return <FoodLoader full />;
}
