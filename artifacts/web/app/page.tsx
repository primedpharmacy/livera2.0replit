import Link from "next/link";
import { ArrowRight, ShieldCheck, Stethoscope, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listClinics } from "@/lib/api/mock";

export default async function RootPage() {
  const clinics = await listClinics();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-16">
        <header className="flex flex-col gap-4">
          <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Livera
          </span>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Clinical admin, sorted.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            One workspace for orders, clinical checks, complaints, incidents and
            GP letters — built for safer, faster clinic operations.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <Stethoscope className="size-6 text-primary" />
              <CardTitle>Clinical check queue</CardTitle>
              <CardDescription>
                Triage orders waiting on prescriber sign-off with full patient
                context.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <ClipboardList className="size-6 text-primary" />
              <CardTitle>Complaints & incidents</CardTitle>
              <CardDescription>
                Track open cases, SLAs and ownership across the whole clinic.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <ShieldCheck className="size-6 text-primary" />
              <CardTitle>GP letter pipeline</CardTitle>
              <CardDescription>
                Compose, review and send GP letters with audit-ready records.
              </CardDescription>
            </CardHeader>
          </Card>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold tracking-tight">
              Choose a clinic workspace
            </h2>
            <p className="text-muted-foreground">
              Jump straight into the dashboard for any clinic in the system.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {clinics.map((clinic) => (
              <Card key={clinic.id} className="flex flex-col">
                <CardHeader className="flex-1">
                  <CardTitle>{clinic.config.clinic_name}</CardTitle>
                  <CardDescription>
                    {clinic.config.legal_entity_name}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-end">
                  <Button asChild>
                    <Link href={`/${clinic.id}/dashboard`}>
                      Open dashboard
                      <ArrowRight />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
