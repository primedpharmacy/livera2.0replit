"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, ShieldCheck, Stethoscope, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RootPage() {
  const router = useRouter();
  const [clinicId, setClinicId] = useState("feeltru");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const id = clinicId.trim();
    if (!id) return;
    router.push(`/${id}/dashboard`);
  }

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
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild size="lg">
              <Link href="/feeltru/dashboard">
                Open dashboard
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/feeltru/intake">Patient intake</Link>
            </Button>
          </div>
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

        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Jump into a clinic workspace</CardTitle>
            <CardDescription>
              Enter a clinic ID to go straight to its dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-4 sm:flex-row sm:items-end"
            >
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="clinic_id">Clinic ID</Label>
                <Input
                  id="clinic_id"
                  name="clinic_id"
                  placeholder="feeltru"
                  value={clinicId}
                  onChange={(e) => setClinicId(e.target.value)}
                />
              </div>
              <Button type="submit">
                Continue
                <ArrowRight />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
