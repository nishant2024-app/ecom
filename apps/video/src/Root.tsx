import { Composition } from 'remotion';
import { PantryReel } from './PantryReel';
import { ProductReel, type ProductReelProps } from './ProductReel';
import './style.css';

const sample: ProductReelProps = {
  name: 'A2 Gir Cow Ghee',
  size: '500 ml',
  tagline: 'Bilona method, from our Gir herd',
  price: '₹1,150',
  pack: { kind: 'jar', color: '#E9B44C', accent: '#14432F' },
  facts: ['Hand-churned curd', 'Wood-fire cooked', 'Keeps 9 months'],
};

export function Root() {
  return (
    <>
      <Composition id="PantryReel" component={PantryReel} durationInFrames={300} fps={30} width={1080} height={1080} />
      <Composition id="ProductReel" component={ProductReel} durationInFrames={240} fps={30} width={1080} height={1350} defaultProps={sample} />
    </>
  );
}
