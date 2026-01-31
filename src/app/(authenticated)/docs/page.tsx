import { db } from "@/lib/db";
import { leagueSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isCommissioner } from "@/lib/auth/server";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Book, Scale, Settings, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

// Document definitions - add more documents here
const documents = [
  {
    id: "constitution",
    title: "League Constitution",
    description: "The official rules and bylaws of the League of Jesters",
    icon: Scale,
    settingKey: "doc_constitution_url",
  },
  {
    id: "salary-rules",
    title: "Salary & Cap Rules",
    description: "Salary cap, escalation rates, and contract rules",
    icon: FileText,
    settingKey: "doc_salary_rules_url",
  },
  {
    id: "draft-rules",
    title: "Draft Rules",
    description: "Rookie draft and free agent auction procedures",
    icon: Book,
    settingKey: "doc_draft_rules_url",
  },
];

async function getDocumentUrls() {
  const settings = await db.select().from(leagueSettings);
  const settingsMap = new Map(settings.map((s) => [s.key, s.value]));
  return settingsMap;
}

export default async function LeagueDocsPage() {
  const [settingsMap, commissioner] = await Promise.all([
    getDocumentUrls(),
    isCommissioner(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">League Documents</h1>
          <p className="text-muted-foreground">
            Official league rules, constitution, and guidelines
          </p>
        </div>
        {commissioner && (
          <Button asChild variant="outline">
            <Link href="/admin/settings">
              <Settings className="h-4 w-4 mr-2" />
              Manage URLs
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {documents.map((doc) => {
          const url = settingsMap.get(doc.settingKey);
          const Icon = doc.icon;

          return (
            <Card key={doc.id} className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  {doc.title}
                </CardTitle>
                <CardDescription>{doc.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {url ? (
                  <Button asChild className="w-full">
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      View Document
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    {commissioner
                      ? "No URL configured. Add in League Settings."
                      : "Document not available yet."}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
