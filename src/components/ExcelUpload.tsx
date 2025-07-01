"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  XIcon,
  UploadIcon,
  CheckCircleIcon,
  XCircleIcon,
  DownloadIcon,
} from "lucide-react";
import { trpc } from "@/app/_trpc/client";
import * as XLSX from "xlsx";

interface ExcelUploadProps {
  onClose: () => void;
  isAdmin: boolean;
}

export function ExcelUpload({ onClose }: ExcelUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: number;
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = trpc.client.uploadFromExcel.useMutation({
    onSuccess: (result) => {
      setUploadResult(result);
      setIsUploading(false);
    },
    onError: (error) => {
      console.error("Upload failed:", error);
      setIsUploading(false);
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      // Check file type - only Excel files allowed
      const validTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
        "application/vnd.ms-excel", // .xls
      ];

      if (!validTypes.includes(selectedFile.type)) {
        alert(
          "Please select a valid Excel file (.xlsx, .xls) only. CSV files are not supported."
        );
        return;
      }

      // Check file size (max 5MB)
      if (selectedFile.size > 5 * 1024 * 1024) {
        alert("File size must be less than 5MB");
        return;
      }

      setFile(selectedFile);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Content = e.target?.result as string;
        const base64Data = base64Content.split(",")[1]; // Remove data URL prefix

        await uploadMutation.mutateAsync({
          fileContent: base64Data,
          fileName: file.name,
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Failed to process file:", error);
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const downloadTemplate = () => {
    // Create template data with multiple phone numbers in the first row
    const templateData = [
      [
        "name",
        "emails",
        "phone",
        "address",
        "city",
        "state",
        "country",
        "companyName",
      ],
      [
        "John Doe",
        "john@example.com, jane@example.com",
        "+1234567890, +1987654321",
        "123 Main St",
        "New York",
        "NY",
        "USA",
        "Example Corp",
      ],
      [
        "Jane Smith",
        "jane@company.com",
        "+0987654321",
        "456 Oak Ave",
        "Los Angeles",
        "CA",
        "USA",
        "Tech Solutions",
      ],
      [
        "Bob Johnson",
        "bob@tech.com, bob@personal.com",
        "+1122334455, +1555666777, +1888999000",
        "789 Tech Blvd",
        "San Francisco",
        "CA",
        "USA",
        "Innovation Inc",
      ],
    ];

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(templateData);

    // Set column widths for better readability
    const columnWidths = [
      { wch: 15 }, // name
      { wch: 30 }, // emails
      { wch: 25 }, // phone
      { wch: 20 }, // address
      { wch: 12 }, // city
      { wch: 10 }, // state
      { wch: 10 }, // country
      { wch: 15 }, // companyName
    ];
    worksheet["!cols"] = columnWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Client Template");

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "client_template.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Upload Clients from Excel</span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <XIcon className="w-4 h-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">Instructions</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Upload an Excel file (.xlsx, .xls) only</li>
              <li>• First row should contain headers</li>
              <li>
                • Required columns: <strong>name</strong>,{" "}
                <strong>emails</strong>
              </li>
              <li>
                • Optional columns: phone, address, city, state, country,
                companyName
              </li>
              <li>
                • Multiple emails can be separated by commas or semicolons
              </li>
              <li>• Multiple phone numbers must be separated by commas only</li>
              <li>• Maximum file size: 5MB</li>
            </ul>
          </div>

          {/* Template Download */}
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={downloadTemplate}
              className="flex items-center gap-2"
            >
              <DownloadIcon className="w-4 h-4" />
              Download Excel Template
            </Button>
          </div>

          {/* File Upload */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />

            {!file ? (
              <div>
                <UploadIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">
                  Click to select an Excel file or drag and drop
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Only .xlsx and .xls files are supported
                </p>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose Excel File
                </Button>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-center gap-2 mb-4">
                  <CheckCircleIcon className="w-8 h-8 text-green-500" />
                  <span className="font-medium text-gray-900">{file.name}</span>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    disabled={isUploading}
                  >
                    Change File
                  </Button>
                  <Button onClick={handleUpload} disabled={isUploading}>
                    {isUploading ? "Uploading..." : "Upload & Process"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Upload Results */}
          {uploadResult && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Upload Results</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircleIcon className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-900">
                      Successful
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-green-900">
                    {uploadResult.success}
                  </p>
                  <p className="text-sm text-green-700">clients imported</p>
                </div>

                {uploadResult.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <XCircleIcon className="w-5 h-5 text-red-600" />
                      <span className="font-medium text-red-900">Errors</span>
                    </div>
                    <p className="text-2xl font-bold text-red-900">
                      {uploadResult.errors.length}
                    </p>
                    <p className="text-sm text-red-700">failed to import</p>
                  </div>
                )}
              </div>

              {/* Error Details */}
              {uploadResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-medium text-red-900 mb-2">
                    Error Details
                  </h4>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {uploadResult.errors.map((error: string, index: number) => (
                      <p key={index} className="text-sm text-red-700">
                        {error}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={handleReset}>
                  Upload Another File
                </Button>
                <Button onClick={onClose}>Done</Button>
              </div>
            </div>
          )}

          {/* Actions */}
          {!uploadResult && (
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
