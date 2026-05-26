"use client";

import * as React from "react";
import {
  ClearanceProgress,
  type ClearanceProgressProps,
} from "@/components/settings/clearance-progress";

interface ClearanceUploadContextValue {
  docUploaded: boolean;
  markDocumentUploaded: () => void;
}

const ClearanceUploadContext = React.createContext<ClearanceUploadContextValue>({
  docUploaded: false,
  markDocumentUploaded: () => {},
});

export function SettingsClearanceProvider({
  initialDocUploaded,
  children,
}: {
  initialDocUploaded: boolean;
  children: React.ReactNode;
}) {
  const [docUploaded, setDocUploaded] = React.useState(initialDocUploaded);

  React.useEffect(() => {
    if (initialDocUploaded) setDocUploaded(true);
  }, [initialDocUploaded]);

  const markDocumentUploaded = React.useCallback(() => {
    setDocUploaded(true);
  }, []);

  return (
    <ClearanceUploadContext.Provider value={{ docUploaded, markDocumentUploaded }}>
      {children}
    </ClearanceUploadContext.Provider>
  );
}

export function useClearanceUpload() {
  return React.useContext(ClearanceUploadContext);
}

export function SettingsClearanceAside(props: ClearanceProgressProps) {
  const { docUploaded } = useClearanceUpload();
  return (
    <ClearanceProgress
      {...props}
      identityDocUploaded={props.identityDocUploaded || docUploaded}
    />
  );
}
