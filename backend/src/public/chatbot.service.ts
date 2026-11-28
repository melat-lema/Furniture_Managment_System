import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CARD_SELECT, PUBLISHED, PublicService, type ProductCard, type ShowroomCard } from './public.service';

export interface ChatAction {
  type: 'call' | 'whatsapp' | 'link';
  label: string;
  href: string;
}

export interface ChatReply {
  reply: string;
  products: ProductCard[];
  showrooms: ShowroomCard[];
  suggestions: string[];
  actions: ChatAction[];
}

/** Words people use for each kind of furniture (English and a few Amharic ones). `search` is what is looked up in the catalog. */
const GROUPS: Array<{ search: string[]; words: string[] }> = [
  { search: ['sofa', 'couch'], words: ['sofa', 'sofas', 'couch', 'couches', 'sectional', 'loveseat', 'ሶፋ'] },
  { search: ['bed'], words: ['bed', 'beds', 'bedroom', 'headboard', 'mattress', 'አልጋ'] },
  { search: ['table', 'desk'], words: ['table', 'tables', 'desk', 'desks', 'ጠረጴዛ'] },
  { search: ['chair', 'stool'], words: ['chair', 'chairs', 'armchair', 'armchairs', 'stool', 'stools', 'ወንበር'] },
  { search: ['wardrobe', 'cabinet', 'closet'], words: ['wardrobe', 'wardrobes', 'closet', 'closets', 'cabinet', 'cabinets', 'cupboard', 'ቁም ሳጥን', 'ቁምሳጥን'] },
  { search: ['dining'], words: ['dining'] },
  { search: ['shelf', 'shelves', 'rack'], words: ['shelf', 'shelves', 'bookshelf', 'bookcase', 'rack', 'tv stand'] },
  { search: ['office'], words: ['office', 'workstation'] },
  { search: ['kids', 'child'], words: ['kids', 'kid', 'children', 'child', 'nursery'] },
];

const STOP = new Set(
  `the a an is are do you have has any got i me my we want need looking look for to of in on at and or with your please can could would
  show see find buy get what which how much does cost price prices under below above less than more about some available new nice good best
  cheap cheapest affordable around between from birr etb it this that there here tell give list all one ones sale selling sell offer offers
  hello hi hey where when who why also just like pieces piece furniture`.split(/\s+/),
);

const ETHIOPIC = /[\u1200-\u137F]/;

const RE = {
  thanks: /\b(thanks|thank you|thx|appreciate)\b|አመሰግናለሁ|እናመሰግናለን/,
  greeting: /\b(hi|hello|hey|hola|selam|good (morning|afternoon|evening))\b|ሰላም|ታዲያስ/,
  location: /\b(where|location|locations|address|addresses|showroom|showrooms|branch|branches|visit|directions|map|find you|located|near)\b|የት|አድራሻ|ሾውሩም/,
  hours: /\b(open|opening|hours|close|closing|closed|schedule|sunday|saturday|weekend)\b|ሰዓት/,
  contact: /\b(phone|call|whatsapp|telegram|email|contact|number|reach|speak|talk)\b|ስልክ|ደውል/,
  payment: /\b(pay|payment|payments|telebirr|cbe|bank|transfer|cash|installment|installments|credit)\b|ክፍያ/,
  delivery: /\b(deliver|delivery|shipping|ship|transport|transportation)\b|ማድረስ|ዴሊቨሪ/,
  custom: /\b(custom|customize|customise|made to order|bespoke|measure|measurements|my own design|tailor)\b|ልዩ ዲዛይን/,
  categories: /\b(categories|category|collections|collection|catalog|catalogue|everything|what do you (sell|make|have)|what (furniture|products))\b/,
  price: /\b(price|prices|cost|costs|how much|cheap|cheapest|affordable|budget|expensive)\b|ዋጋ/,
};

const hasEthiopic = (text: string): boolean => ETHIOPIC.test(text);

/** Does the text contain this word as a whole word? (Amharic words are matched as plain text.) */
function hasWord(text: string, word: string): boolean {
  if (ETHIOPIC.test(word)) return text.includes(word);
  return new RegExp(`(?:^| )${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?: |$)`).test(text);
}

/** A budget like "under 20000", "below 20k" or "20,000 birr". */
function budgetOf(text: string): number | null {
  for (const match of text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(k|thousand)?/g)) {
    let value = Number(match[1].replace(/,/g, ''));
    if (!Number.isFinite(value)) continue;
    if (match[2]) value *= 1000;
    if (value >= 500) return value; // small numbers are probably "2 chairs", not money
  }
  return null;
}

@Injectable()
export class ChatbotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly site: PublicService,
  ) {}

  async reply(message: string): Promise<ChatReply> {
    const text = message.toLowerCase().replace(/[?!.,;:()"“”]/g, ' ').replace(/\s+/g, ' ').trim();
    const am = hasEthiopic(message);
    const [showrooms, categories] = await Promise.all([this.site.showrooms(), this.site.categories()]);
    const contact = this.site.contact();
    const phone = contact.phone ?? showrooms.find((room) => room.phone)?.phone ?? null;

    const base = (reply: string, extra: Partial<ChatReply> = {}): ChatReply => ({
      reply,
      products: [],
      showrooms: [],
      suggestions: this.suggestions(categories.map((category) => category.name), am),
      actions: [],
      ...extra,
    });
    const reach = (): ChatAction[] => {
      const actions: ChatAction[] = [];
      if (phone) actions.push({ type: 'call', label: am ? 'ይደውሉ' : 'Call us', href: `tel:${phone.replace(/[^\d+]/g, '')}` });
      if (contact.whatsapp) actions.push({ type: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/${contact.whatsapp}` });
      return actions;
    };

    // ----- what kind of furniture, and what budget?
    const terms = this.termsOf(text);
    const budget = budgetOf(text);
    const asksPrice = RE.price.test(text);
    const wantsCheap = /\b(cheap|cheapest|affordable|budget)\b/.test(text);

    // ----- small talk
    if (RE.thanks.test(text)) {
      return base(am ? 'ምንም አይደለም! ሌላ ነገር ከፈለጉ ይጠይቁኝ።' : "You're welcome! Ask me anything else about our furniture or showrooms.");
    }
    if (RE.greeting.test(text) && terms.length === 0 && text.split(' ').length <= 5) {
      return base(
        am
          ? 'ሰላም! እንኳን ወደ Gorgeous Furniture በደህና መጡ። ስለ ምርቶቻችን፣ ዋጋ ወይም የሾውሩም አድራሻ ሊጠይቁኝ ይችላሉ።'
          : 'Hello and welcome to Gorgeous Furniture! I can show you our pieces, tell you about prices, or help you find a showroom. What are you looking for?',
      );
    }

    // ----- showrooms, hours, contact
    if (RE.location.test(text) && terms.length === 0) {
      if (showrooms.length === 0) {
        return base(am ? 'የሾውሩም አድራሻዎችን ለማግኘት እባክዎ ይደውሉልን።' : 'Please call us and we will tell you the nearest showroom.', { actions: reach() });
      }
      return base(am ? 'የእኛ ሾውሩሞች እነዚህ ናቸው፦' : 'You are welcome to visit any of our showrooms:', { showrooms, actions: reach() });
    }
    if (RE.hours.test(text) && terms.length === 0) {
      return base(
        contact.hours
          ? `${am ? 'የሥራ ሰዓታችን፦' : 'Our opening hours:'} ${contact.hours}`
          : am
            ? 'የሥራ ሰዓት እንደ ሾውሩሙ ሊለያይ ይችላል። እባክዎ ከመምጣትዎ በፊት ይደውሉ።'
            : 'Opening hours can differ between showrooms, so please call before you come and we will confirm.',
        { showrooms, actions: reach() },
      );
    }
    if (RE.contact.test(text) && terms.length === 0) {
      const actions = reach();
      return base(
        actions.length > 0
          ? am
            ? 'እኛን ለማግኘት ከታች ያሉትን ይጠቀሙ፦'
            : `You can reach us here${phone ? `: ${phone}` : ''}.`
          : am
            ? 'እባክዎ ሾውሩሞቻችንን በአካል ይጎብኙ።'
            : 'Please visit one of our showrooms and our team will be happy to help.',
        { actions, showrooms: actions.length === 0 ? showrooms : [] },
      );
    }

    // ----- policies (kept honest: the team confirms details)
    if (RE.payment.test(text) && terms.length === 0) {
      return base(
        am
          ? 'በሾውሩሞቻችን በጥሬ ገንዘብ፣ በባንክ ትራንስፈር፣ በቴሌብር እና በCBE Birr መክፈል ይችላሉ።'
          : 'In our showrooms you can pay by cash, bank transfer, Telebirr or CBE Birr. Our team will give you a receipt for every payment.',
      );
    }
    if (RE.delivery.test(text) && terms.length === 0) {
      return base(
        am
          ? 'ማድረስ ስለሚቻልበት ሁኔታና ወጪ እባክዎ ሾውሩሙን ያነጋግሩ።'
          : 'Our showroom team can arrange delivery. Please ask them for the cost and time for your area.',
        { actions: reach() },
      );
    }
    if (RE.custom.test(text) && terms.length === 0) {
      return base(
        am
          ? 'የራሳችን ዎርክሾፕ ስላለን ልዩ መጠንና አጨራረስ ማነጋገር ይቻላል። ቡድናችን ምን እንደሚቻል ያሳውቅዎታል።'
          : 'Because we build our furniture in our own workshop, custom sizes and finishes can be discussed. Our team will tell you what is possible.',
        { actions: reach() },
      );
    }

    // ----- collections
    if (RE.categories.test(text) && terms.length === 0) {
      if (categories.length === 0) return base(am ? 'ምርቶቻችንን በቅርቡ እናሳያለን።' : 'Our collection is being updated. Please check back soon.');
      return base(
        `${am ? 'የምርት ዓይነቶቻችን፦' : 'Here is what we make:'} ${categories.map((category) => `${category.name} (${category.count})`).join(', ')}.`,
      );
    }

    // ----- finding pieces
    if (terms.length > 0 || budget !== null || wantsCheap) {
      const products = await this.search(terms, budget, wantsCheap);
      if (products.length > 0) {
        const showPrices = this.site.showPrices();
        const note = budget !== null && showPrices ? ` ${am ? 'እስከ' : 'up to'} ETB ${budget.toLocaleString('en-US')}` : '';
        return base(
          am ? `ያገኘኋቸው ምርቶች${note}፦` : `Here are some pieces${note} that match:`,
          { products, actions: reach() },
        );
      }
      return base(
        am
          ? 'ለዚህ የሚሆን ምርት አላገኘሁም። ሌላ ቃል ይሞክሩ ወይም ይደውሉልን።'
          : "I couldn't find a match for that. Try another word, browse a category below, or call us and we will help you find it.",
        { actions: reach() },
      );
    }

    if (asksPrice) {
      const range = await this.priceRange();
      if (range && this.site.showPrices()) {
        return base(
          am
            ? `ዋጋዎቻችን ከ ETB ${range.min.toLocaleString('en-US')} ይጀምራሉ። የሚፈልጉትን ምርት ይንገሩኝ።`
            : `Our pieces start from ETB ${range.min.toLocaleString('en-US')}. Tell me what you are looking for (for example "sofa under 30000") and I will show you options.`,
        );
      }
      return base(
        am ? 'ዋጋዎችን ሾውሩሞቻችን ያሳውቁዎታል። እባክዎ ይደውሉ ወይም ይጎብኙ።' : 'Our showroom team will share prices with you. Please call or visit us.',
        { actions: reach() },
      );
    }

    return base(
      am
        ? 'ይቅርታ፣ ጥያቄዎን በትክክል አልገባኝም። ስለ ምርቶች፣ ዋጋ ወይም አድራሻ ይጠይቁ፣ ወይም ይደውሉልን።'
        : "Sorry, I didn't quite get that. You can ask me about our furniture, prices, payment, or where our showrooms are, or call us and the team will help.",
      { actions: reach() },
    );
  }

  // ---------------------------------------------------------------- helpers
  /** The words to look for in the catalog: the kinds of furniture mentioned, plus any other meaningful word (leather, oak...). */
  private termsOf(text: string): string[] {
    const terms = new Set<string>();
    const known = new Set<string>();
    for (const group of GROUPS) {
      for (const word of group.words) {
        known.add(word);
        if (hasWord(text, word)) group.search.forEach((term) => terms.add(term));
      }
    }
    for (const token of text.split(' ')) {
      if (token.length < 4 || /\d/.test(token) || STOP.has(token) || known.has(token)) continue;
      if (RE.location.test(token) || RE.contact.test(token) || RE.payment.test(token) || RE.delivery.test(token) || RE.hours.test(token) || RE.custom.test(token) || RE.categories.test(token)) continue;
      if (hasEthiopic(token)) continue;
      terms.add(token);
    }
    return [...terms].slice(0, 6);
  }

  private async search(terms: string[], maxPrice: number | null, cheapest: boolean): Promise<ProductCard[]> {
    const showPrices = this.site.showPrices();
    const where: Prisma.ProductWhereInput = {
      ...PUBLISHED,
      ...(maxPrice !== null && showPrices && { price: { lte: maxPrice } }),
      ...(terms.length > 0 && {
        OR: terms.flatMap((term): Prisma.ProductWhereInput[] => [
          { name: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { material: { contains: term, mode: 'insensitive' } },
          { category: { name: { contains: term, mode: 'insensitive' } } },
        ]),
      }),
    };
    const rows = await this.prisma.product.findMany({
      where,
      select: CARD_SELECT,
      take: 40,
      orderBy: cheapest && showPrices ? { price: 'asc' } : { createdAt: 'desc' },
    });

    // the pieces that match the most words come first
    const score = (row: (typeof rows)[number]): number => {
      const haystack = `${row.name} ${row.description ?? ''} ${row.material ?? ''} ${row.category.name}`.toLowerCase();
      return terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0) + (row.name.toLowerCase().includes(term) ? 1 : 0), 0);
    };
    return rows
      .map((row) => ({ row, score: score(row) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(({ row }) => this.site.card(row));
  }

  private async priceRange(): Promise<{ min: number } | null> {
    const lowest = await this.prisma.product.aggregate({ where: PUBLISHED, _min: { price: true } });
    return lowest._min.price ? { min: Number(lowest._min.price.toString()) } : null;
  }

  private suggestions(categoryNames: string[], am: boolean): string[] {
    if (am) return ['ሾውሩሞች የት ናቸው?', 'እንዴት መክፈል እችላለሁ?', 'ስልክ ቁጥር'];
    const first = categoryNames.slice(0, 2).map((name) => `Show me ${name.toLowerCase()}`);
    return [...first, 'Where are your showrooms?', 'How can I pay?'].slice(0, 4);
  }
}
