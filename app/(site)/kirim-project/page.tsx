import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SubmissionForm } from "@/components/forms/SubmissionForm";
import { SectionHeading } from "@/components/SectionHeading";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Kirim Foto Project Customer",
  description: "Bagikan foto hasil project dan testimoni Anda bersama kami.",
  path: "/kirim-project",
});

export default function SubmitProjectPage() {
  return (
    <section className="container max-w-3xl pb-20 pt-8 sm:pt-12">
      <Breadcrumbs items={[{ name: "Kirim Foto Project", href: "/kirim-project" }]} />
      <SectionHeading as="h1" eyebrow="Customer Project" title="Bagikan hasil project Anda" description="Kirim foto furniture dari kami yang sudah terpasang di rumah Anda. Setelah diverifikasi admin, foto dan testimoni akan tampil di portfolio & review." />
      <div className="card p-5 sm:p-8">
        <SubmissionForm />
      </div>
    </section>
  );
}
