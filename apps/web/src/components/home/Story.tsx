import type { StoreContent } from '@/lib/types';
import { Photo } from '../ProductImage';
import { Reveal } from '../Reveal';
import { BatchTicket } from './BatchTicket';

export function Story({ content }: { content: StoreContent }) {
  const { story } = content;
  if (!story.title && !story.paragraphs.length) return null;
  const img = content.images.story;
  return (
    <section id="story" className="mx-auto grid max-w-[1320px] scroll-mt-24 gap-10 px-4 md:px-8 lg:grid-cols-12">
      <Reveal className="lg:col-span-5">
        {img ? (
          <figure>
            <Photo img={img} sizes="(min-width: 1024px) 40vw, 100vw" className="aspect-[4/5] w-full object-cover" />
            {img.alt && <figcaption className="mt-3 font-serif text-[15px] italic text-ink-2">{img.alt}</figcaption>}
          </figure>
        ) : (
          <BatchTicket />
        )}
      </Reveal>
      <div className="lg:col-span-6 lg:col-start-7 lg:pt-8">
        <h2 className="font-display text-[clamp(34px,4vw,56px)] leading-[1.02]">{story.title}</h2>
        <div className="mt-8 space-y-5 font-serif text-[20px] leading-[1.6] text-ink-2 first-letter:float-left first-letter:mr-2 first-letter:font-display first-letter:text-[64px] first-letter:leading-[0.85] first-letter:text-forest">
          {story.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        {story.signature && <p className="mt-8 font-serif text-lg italic">— {story.signature}</p>}
      </div>
    </section>
  );
}
