import { CircleAlert, RotateCw } from "lucide-react";
import { LogoMark } from "./components/brand/Logo";
import { Workspace } from "./components/layout/Workspace";
import { Button } from "./components/ui/Button";
import { Toasts } from "./components/ui/Toasts";
import { WidgetDemo } from "./components/widget/WidgetDemo";
import { AppProvider, useApp } from "./state/AppContext";

function Shell() {
  const { session, retrySession, route } = useApp();

  if (session.status === "error") {
    return (
      <div className="boot" role="alert">
        <LogoMark size={40} />
        <CircleAlert size={20} aria-hidden className="boot__icon" />
        <h1>{session.title}</h1>
        <p>{session.detail}</p>
        <Button variant="primary" icon={<RotateCw size={15} />} onClick={retrySession}>
          Подключиться снова
        </Button>
      </div>
    );
  }

  return (
    <>
      {route.view === "widget" ? <WidgetDemo /> : <Workspace conversationId={route.conversationId} />}
      <Toasts />
    </>
  );
}

export default function App({ mocksEnabled }: { mocksEnabled: boolean }) {
  return (
    <AppProvider mocksEnabled={mocksEnabled}>
      <Shell />
    </AppProvider>
  );
}
