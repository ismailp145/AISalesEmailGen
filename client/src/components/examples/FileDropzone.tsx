import { FileDropzone } from "../FileDropzone";

export default function FileDropzoneExample() {
  return (
    <div className="w-full max-w-2xl p-4">
      <FileDropzone onFileSelect={(file) => console.log("File selected:", file.name)} />
    </div>
  );
}
