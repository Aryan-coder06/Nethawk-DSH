import { motion } from 'framer-motion';

interface GuideItem {
  title: string;
  description: string;
}

interface HeadlinePart {
  text: string;
  highlight?: boolean;
}

interface PageGuideProps {
  eyebrow?: string;
  headlineParts: HeadlinePart[];
  description: string;
  items: GuideItem[];
  innovations: string[];
  highlightClassName?: string;
}

export function PageGuide({
  eyebrow = 'NetHawk Guide',
  headlineParts,
  description,
  items,
  innovations,
  highlightClassName = 'text-cyan-400'
}: PageGuideProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true, amount: 0.2 }}
      className="relative overflow-hidden rounded-3xl border bg-card/60 p-8 md:p-12"
    >
      <div className="absolute -right-24 top-0 h-64 w-64 rounded-full bg-gradient-to-br from-cyan-400/20 to-transparent blur-3xl" />
      <div className="absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-gradient-to-tr from-teal-400/20 to-transparent blur-3xl" />
      <motion.div
        aria-hidden="true"
        className="absolute left-8 top-10 h-10 w-[2px] bg-gradient-to-b from-cyan-400/0 via-cyan-400/70 to-cyan-400/0"
        animate={{ opacity: [0.2, 1, 0.2], y: [0, 8, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative z-10 space-y-6">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">{eyebrow}</p>
          <h2 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
            {headlineParts.map((part, index) => (
              <span key={`${part.text}-${index}`} className={part.highlight ? highlightClassName : undefined}>
                {part.text}
              </span>
            ))}
          </h2>
          <p className="text-xl font-medium text-muted-foreground max-w-3xl">{description}</p>
        </div>

        <div className="space-y-8">
          <div className="space-y-4">
            {items.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                viewport={{ once: true, amount: 0.2 }}
                className="flex items-start gap-4 border-b border-border/60 pb-4 last:border-none last:pb-0"
              >
                <span className={`mt-2 h-2.5 w-2.5 rounded-full ${highlightClassName} bg-current`} />
                <div>
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">What’s new here</p>
            <h3 className="text-2xl font-semibold text-foreground">
              Practical innovation you can feel
            </h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {innovations.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className={`mt-1 h-2.5 w-2.5 rounded-full ${highlightClassName} bg-current`} />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
