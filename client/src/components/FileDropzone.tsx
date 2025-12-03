import { useCallback, useState } from "react";
import { Upload, FileSpreadsheet, X, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSize?: number;
}

export function FileDropzone({ onFileSelect, accept = ".csv", maxSize = 5 * 1024 * 1024 }: FileDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    setError(null);
    
    if (!file.name.endsWith(".csv")) {
      setError("Please upload a CSV file");
      return;
    }
    
    if (file.size > maxSize) {
      setError(`File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`);
      return;
    }
    
    setSelectedFile(file);
    onFileSelect(file);
  }, [onFileSelect, maxSize]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const clearFile = useCallback(() => {
    setSelectedFile(null);
    setError(null);
  }, []);

  return (
    <Card
      className={cn(
        "border-2 border-dashed transition-colors",
        isDragOver && "border-primary bg-primary/5",
        error && "border-destructive",
        selectedFile && "border-emerald-500/50 bg-emerald-500/5"
      )}
    >
      <CardContent className="p-8">
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className="flex flex-col items-center justify-center gap-4 text-center"
        >
          {selectedFile ? (
            <>
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-foreground">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span className="font-medium">{selectedFile.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6"
                    onClick={clearFile}
                    data-testid="button-clear-file"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
                <Upload className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-foreground font-medium">
                  Drop your CSV file here, or{" "}
                  <label className="text-primary cursor-pointer hover:underline">
                    browse
                    <input
                      type="file"
                      accept={accept}
                      onChange={handleInputChange}
                      className="hidden"
                      data-testid="input-file-upload"
                    />
                  </label>
                </p>
                <p className="text-sm text-muted-foreground">
                  Required headers: first_name, last_name, title, company, email, linkedin_url, notes
                </p>
              </div>
            </>
          )}
          {error && (
            <p className="text-sm text-destructive" data-testid="text-file-error">
              {error}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
