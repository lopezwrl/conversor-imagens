import { useRef } from "react";
import { AnimatePresence, MotionConfig } from "framer-motion";
import { SectionProvider, useSection } from "../state/section";
import { ToastProvider } from "../state/toasts";
import { ImagesProvider } from "../state/images";
import { DocumentsProvider } from "../state/documents";
import { Header } from "../components/layout/Header";
import { Toasts } from "../components/ui/Toasts";
import { EstuaryCanvas } from "../features/estuary/EstuaryCanvas";
import { Portal } from "../features/portal/Portal";
import { ImageStudio } from "../features/images/ImageStudio";
import { DocumentStudio } from "../features/documents/DocumentStudio";

function Shell() {
  const { section } = useSection();
  const titleAnchorRef = useRef<HTMLHeadingElement | null>(null);

  return (
    <div className="relative min-h-screen">
      <EstuaryCanvas titleAnchorRef={titleAnchorRef} />

      <div className="relative z-10 flex min-h-screen flex-col">
        <Header />

        <main className="flex-1">
          <AnimatePresence mode="wait">
            {section === "portal" && <Portal key="portal" titleAnchorRef={titleAnchorRef} />}
            {section === "photos" && <ImageStudio key="photos" />}
            {section === "docs" && <DocumentStudio key="docs" />}
          </AnimatePresence>
        </main>
      </div>

      <Toasts />
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <SectionProvider>
          <ImagesProvider>
            <DocumentsProvider>
              <Shell />
            </DocumentsProvider>
          </ImagesProvider>
        </SectionProvider>
      </ToastProvider>
    </MotionConfig>
  );
}
