import { notFound } from "next/navigation";
import NewUserExperienceClient from "./NewUserExperienceClient";

export default function NewUserExperiencePage() {
  if (
    process.env.NODE_ENV !== "development" &&
    process.env.NEXT_PUBLIC_ENABLE_NEW_USER_AUDIT !== "true"
  ) {
    notFound();
  }

  return <NewUserExperienceClient />;
}
