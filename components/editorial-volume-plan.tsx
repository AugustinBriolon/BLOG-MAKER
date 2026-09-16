/**
 * Plan de volume éditorial (sans IA) : semaines × articles/semaine → N.
 * État local only — pas de génération ni de persist.
 */
import { useState } from "react";
import { NumberFlowValue } from "@/components/number-flow-value";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const VOLUME_BOUNDS = {
  weeksMin: 1,
  weeksMax: 12,
  weeksDefault: 4,
  articlesMin: 1,
  articlesMax: 5,
  articlesDefault: 2,
  totalCap: 60,
} as const;

function clampTotal(weeks: number, articlesPerWeek: number) {
  return Math.min(weeks * articlesPerWeek, VOLUME_BOUNDS.totalCap);
}

export function EditorialVolumePlan() {
  const [weeks, setWeeks] = useState<number>(VOLUME_BOUNDS.weeksDefault);
  const [articlesPerWeek, setArticlesPerWeek] = useState<number>(
    VOLUME_BOUNDS.articlesDefault,
  );

  const total = clampTotal(weeks, articlesPerWeek);

  return (
    <Card size="sm" className="bg-background/70">
      <CardHeader className="gap-1">
        <CardTitle className="font-heading text-lg font-semibold">
          Plan éditorial
        </CardTitle>
        <CardDescription>
          Combien d’articles, sur combien de semaines — sans génération.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="plan-weeks">Semaines à programmer</Label>
            <span className="tabular-nums text-sm text-muted-foreground">
              {weeks}
            </span>
          </div>
          <Slider
            id="plan-weeks"
            min={VOLUME_BOUNDS.weeksMin}
            max={VOLUME_BOUNDS.weeksMax}
            step={1}
            value={[weeks]}
            onValueChange={(value) => {
              const next = Array.isArray(value) ? value[0] : value;
              if (typeof next === "number") setWeeks(next);
            }}
            aria-label="Nombre de semaines"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="plan-articles">Articles par semaine</Label>
            <span className="tabular-nums text-sm text-muted-foreground">
              {articlesPerWeek}
            </span>
          </div>
          <Slider
            id="plan-articles"
            min={VOLUME_BOUNDS.articlesMin}
            max={VOLUME_BOUNDS.articlesMax}
            step={1}
            value={[articlesPerWeek]}
            onValueChange={(value) => {
              const next = Array.isArray(value) ? value[0] : value;
              if (typeof next === "number") setArticlesPerWeek(next);
            }}
            aria-label="Articles par semaine"
          />
        </div>

        <Separator />

        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Total articles
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {weeks} × {articlesPerWeek}
              {total < weeks * articlesPerWeek ? " (plafond 60)" : ""}
            </p>
          </div>
          <p className="font-heading text-4xl font-semibold tabular-nums leading-none text-foreground">
            <NumberFlowValue value={total} />
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/** Skeleton aligned with plan card header + two sliders + total */
export function EditorialVolumePlanSkeleton() {
  return (
    <div
      className="space-y-5 rounded-2xl bg-card py-4 ring-1 ring-foreground/10"
      aria-busy="true"
    >
      <div className="space-y-2 px-4">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-[min(100%,20rem)]" />
      </div>
      <div className="space-y-6 px-4">
        <div className="space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-6" />
          </div>
          <Skeleton className="h-3 w-full rounded-4xl" />
        </div>
        <div className="space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-6" />
          </div>
          <Skeleton className="h-3 w-full rounded-4xl" />
        </div>
        <div className="flex items-end justify-between pt-2">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-10 w-14" />
        </div>
      </div>
    </div>
  );
}
