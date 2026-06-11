"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, Upload, Loader2 } from "lucide-react";
import {
  journalEntrySchema,
  type JournalEntryInput,
  TRADE_TYPES,
  TRADE_OUTCOMES,
  SUGGESTED_TAGS,
} from "@/lib/validations/journal";
import type { JournalEntryDTO, TradeOutcome, TradeType } from "@/types";
import {
  useCreateJournalEntry,
  useUpdateJournalEntry,
} from "@/hooks/use-journal";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Props {
  existing?: JournalEntryDTO;
  onDone: () => void;
}

function toDateInput(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  return d.toISOString().slice(0, 10);
}

export function JournalForm({ existing, onDone }: Props) {
  const create = useCreateJournalEntry();
  const update = useUpdateJournalEntry();
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState(existing?.screenshotUrl ?? "");
  const [uploading, setUploading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(journalEntrySchema),
    defaultValues: {
      date: toDateInput(existing?.date),
      amount: existing?.amount ?? 0,
      tradeType: existing?.tradeType ?? "INTRADAY",
      outcome: existing?.outcome ?? "PROFIT",
      reason: existing?.reason ?? "",
      notes: existing?.notes ?? "",
      mistakeMade: existing?.mistakeMade ?? "",
      lessonLearned: existing?.lessonLearned ?? "",
      screenshotUrl: existing?.screenshotUrl ?? "",
      tags: existing?.tags ?? [],
    },
  });

  const tradeType = watch("tradeType");
  const outcome = watch("outcome");

  function addTag(tag: string) {
    const t = tag.trim();
    if (t && !tags.includes(t)) {
      const next = [...tags, t];
      setTags(next);
      setValue("tags", next);
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    const next = tags.filter((x) => x !== tag);
    setTags(next);
    setValue("tags", next);
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const supabase = createClient();
      const path = `screenshots/${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage
        .from("journal")
        .upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("journal").getPublicUrl(path);
      setScreenshotUrl(data.publicUrl);
      setValue("screenshotUrl", data.publicUrl);
      toast.success("Screenshot uploaded");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Upload failed (create a 'journal' storage bucket)",
      );
    } finally {
      setUploading(false);
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    const payload = { ...(values as JournalEntryInput), tags, screenshotUrl };
    if (existing) {
      await update.mutateAsync({ id: existing.id, input: payload });
    } else {
      await create.mutateAsync(payload);
    }
    onDone();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Date</Label>
          <Input type="date" {...register("date")} />
        </div>
        <div className="space-y-1.5">
          <Label>Trade type</Label>
          <Select value={tradeType} onValueChange={(v) => setValue("tradeType", v as TradeType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRADE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Outcome</Label>
          <Select value={outcome} onValueChange={(v) => setValue("outcome", v as TradeOutcome)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRADE_OUTCOMES.map((o) => (
                <SelectItem key={o} value={o}>
                  {o.charAt(0) + o.slice(1).toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Amount (₹)</Label>
        <Input type="number" step="0.01" {...register("amount")} />
        {errors.amount && (
          <p className="text-xs text-destructive">{errors.amount.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Reason / setup</Label>
        <Input placeholder="e.g. Bull flag breakout on 15m" {...register("reason")} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Mistake made</Label>
          <Textarea rows={2} {...register("mistakeMade")} />
        </div>
        <div className="space-y-1.5">
          <Label>Lesson learned</Label>
          <Textarea rows={2} {...register("lessonLearned")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Textarea rows={2} {...register("notes")} />
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label>Tags</Label>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <Badge key={t} variant="secondary" className="gap-1">
              {t}
              <button type="button" onClick={() => removeTag(t)}>
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
        <Input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag(tagInput);
            }
          }}
          placeholder="Type a tag and press Enter"
        />
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_TAGS.filter((t) => !tags.includes(t)).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => addTag(t)}
              className={cn(
                "rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground",
                "hover:border-primary hover:text-primary",
              )}
            >
              + {t}
            </button>
          ))}
        </div>
      </div>

      {/* Screenshot */}
      <div className="space-y-1.5">
        <Label>Screenshot</Label>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary">
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {uploading ? "Uploading…" : "Upload image"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
          </label>
          {screenshotUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={screenshotUrl}
              alt="screenshot"
              className="size-12 rounded-lg object-cover ring-1 ring-border"
            />
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || uploading}>
          {existing ? "Save changes" : "Add entry"}
        </Button>
      </div>
    </form>
  );
}
