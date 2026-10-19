This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## WhatsApp follow-up templates

The scheduled WhatsApp checks send the `site_visit_reminder`, `property_followup`, and `post_site_visit_followup` templates using the `en`, `hi`, or `gu` language variant. Template body parameters are sent in this order:

- `site_visit_reminder`: customer name, property name, visit date, visit time. Sent two hours before a scheduled visit.
- `property_followup`: customer name. Sent six days after lead creation, then every six days after the previous send, regardless of enquiry completion. Opted-out leads are excluded.
- `post_site_visit_followup`: customer name, property name. Sent when an owner or channel partner marks a visit completed.

The numeric IDs from Meta are not used in Cloud API send requests. The Gujarati post-visit template name in the supplied Meta definition is `post_site_visit_followu`, so the sender uses that exact name for Gujarati and `post_site_visit_followup` for English and Hindi. Template quick-reply payloads are passed through to the webhook for the site-visit actions, property follow-up actions, and `main_menu` action. Site-visit reminders and both follow-ups are run by the existing cron jobs.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
