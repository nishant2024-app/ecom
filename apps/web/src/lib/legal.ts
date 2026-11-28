/**
 * Policy pages Cashfree (and Indian consumer law) expect on a live store. Written for this business model:
 * prepaid only, shelf-stable food shipped by courier. Have your lawyer or CA review them before launch.
 */
export interface LegalDoc {
  title: string;
  description: string;
  sections: { h: string; p: string[] }[];
}

export function legalDocs(b: { name: string; legalName: string; email: string; phone: string; address: string }): Record<string, LegalDoc> {
  return {
    privacy: {
      title: 'Privacy policy',
      description: `How ${b.name} collects, uses and protects your personal data.`,
      sections: [
        {
          h: 'What we collect',
          p: [
            'When you sign in with Google we receive your name, email address and Google account ID. When you order we store your delivery addresses and phone number, and your order history. If you choose to pin your address on the map or use your current location, we also store that exact location with the address so the delivery partner can find you. We ask your browser or phone for location permission only when you tap the button, and you can add an address without it.',
            'We do not receive or store your card, UPI or bank details. Payments are handled by Cashfree Payments, who process them under their own privacy policy.',
          ],
        },
        {
          h: 'Why we use it',
          p: [
            'To deliver your orders, take payment, send order updates, answer your questions and meet our tax and food-safety obligations. If you opt in, we also send occasional offers, and you can opt out at any time from your account.',
          ],
        },
        {
          h: 'Who we share it with',
          p: [
            'Courier partners (name, address, phone and, if you shared it, the map location, to deliver your parcel), Cashfree Payments (to take payment and issue refunds), and service providers that host our systems. We never sell your data.',
          ],
        },
        {
          h: 'Reading the shop in another language',
          p: [
            'If you choose a language other than English, the text of the page you are viewing is sent to Google Translate so your browser can show it translated. We do not store translations and nothing is sent to Google unless you choose a language. Choose English to turn it off.',
          ],
        },
        { h: 'How long we keep it', p: ['Order and invoice records are kept for as long as Indian tax law requires. Everything else is deleted within 30 days of you deleting your account.'] },
        { h: 'Your rights', p: ['You can see and change your details in your account, and delete your account from Account → Delete my account. For any other request write to ' + b.email + '.'] },
        { h: 'Grievance officer', p: [`${b.legalName}, ${b.address}. Email ${b.email}, phone ${b.phone}. We reply within 7 days.`] },
      ],
    },
    terms: {
      title: 'Terms and conditions',
      description: `The terms for buying from ${b.name}.`,
      sections: [
        { h: 'Who we are', p: [`This store is run by ${b.legalName}, ${b.address}.`] },
        {
          h: 'Orders and prices',
          p: [
            'Prices are in Indian rupees and include GST. Shipping is shown at checkout before you pay. An order is confirmed once payment succeeds; unpaid orders are cancelled automatically after 30 minutes.',
            'We may cancel an order if a product turns out to be unavailable or a price was shown wrongly, and we refund you in full if we do.',
          ],
        },
        { h: 'Payment', p: ['We accept prepaid payments only (UPI, cards, net banking and wallets) through Cashfree Payments. Cash on delivery is not available.'] },
        { h: 'Delivery', p: ['See our shipping policy for areas, charges and timelines.'] },
        {
          h: 'Product information',
          p: [
            'Ingredients, nutrition, shelf life and storage instructions are printed on each pack and on the product page. Please read them, especially if you have allergies: all our products contain milk.',
          ],
        },
        { h: 'Liability', p: ['Our liability for any order is limited to the amount you paid for it. Nothing here limits your rights under the Consumer Protection Act, 2019.'] },
        { h: 'Law', p: ['These terms are governed by Indian law. Courts in Pune, Maharashtra have jurisdiction.'] },
      ],
    },
    refunds: {
      title: 'Cancellation and refund policy',
      description: 'Cancel before we pack and get a full refund. Damaged or wrong items are replaced or refunded.',
      sections: [
        { h: 'Cancelling', p: ['You can cancel from your account until we pack the order. The full amount is refunded to the payment method you used.'] },
        {
          h: 'Damaged, leaking or wrong items',
          p: [`Tell us within 48 hours of delivery at ${b.email} or ${b.phone} with your order number and a photo. We send a replacement or refund the item, your choice.`],
        },
        { h: 'Returns', p: ['Because these are food products, we cannot accept returns of opened packs or change-of-mind returns after delivery.'] },
        { h: 'When refunds arrive', p: ['Refunds are started within 2 working days of approval. Banks usually credit them within 5–7 working days; UPI refunds are often faster.'] },
      ],
    },
    'shipping-policy': {
      title: 'Shipping policy',
      description: 'Where we ship, what it costs and how long it takes.',
      sections: [
        { h: 'Where we ship', p: ['Anywhere in India that our courier partners reach. Army post office (APO) addresses are not served yet.'] },
        { h: 'Dispatch', p: ['Orders are packed and handed to the courier the next working day (we do not dispatch on Sundays or public holidays).'] },
        {
          h: 'Delivery times and charges',
          p: [
            'Charges depend on your pincode and parcel weight and are shown at checkout before you pay, along with expected delivery dates. Orders above the free-shipping amount for your area ship free.',
          ],
        },
        { h: 'Tracking', p: ['When your parcel ships, the courier name and tracking number appear on your order page.'] },
        { h: 'Freshness', p: ['We always send the oldest safe batch first and never ship a product with less than 7 days of shelf life left.'] },
      ],
    },
    contact: {
      title: 'Contact us',
      description: `Write to or call ${b.name}.`,
      sections: [
        { h: 'Customer care', p: [`Email: ${b.email}`, `Phone: ${b.phone} (Monday to Saturday, 10 am – 6 pm)`] },
        { h: 'Registered address', p: [`${b.legalName}`, b.address] },
      ],
    },
  };
}
