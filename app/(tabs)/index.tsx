// app/index.tsx
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  CameraView,
  CameraType,
  useCameraPermissions,
} from "expo-camera";
import * as ImagePicker from "expo-image-picker";

// 👇 import auth hook from your _layout.tsx
import { useAuth } from "../_layout";


const BACKEND_UPLOAD_URL = "http://192.168.0.153:3000/upload-receipt";

type FlashMode = "off" | "on" | "auto";

export default function HomeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);

  const [facing, setFacing] = useState<CameraType>("back");
  const [flash, setFlash] = useState<FlashMode>("off");

  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // 👇 from Microsoft auth (via _layout)
  const { signOut } = useAuth();

  const { authState } = useAuth();

  console.log(
    "User from authState:",
    authState?.givenName,
    authState?.surname
  );

  const handleToggleCamera = () => {
    setFacing((prev) => (prev === "back" ? "front" : "back"));
  };

  const handleToggleFlash = () => {
    setFlash((current) =>
      current === "off" ? "on" : current === "on" ? "auto" : "off"
    );
  };

  const handleTakePicture = async () => {
    if (!cameraRef.current || !permission?.granted) return;

    try {
      const photo = await cameraRef.current.takePictureAsync();
      if (photo?.uri) {
        setSelectedImages((prev) => [...prev, photo.uri]);
        setUploadStatus(null);
      }
    } catch (error) {
      console.warn("Error taking picture:", error);
    }
  };

  const handlePickFromFiles = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
        allowsMultipleSelection: true, // multi-select
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uris = result.assets.map((asset) => asset.uri);
        setSelectedImages((prev) => [...prev, ...uris]);
        setUploadStatus(null);
      }
    } catch (error) {
      console.warn("Error picking image from files:", error);
    }
  };

  const handleRemoveAt = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setUploadStatus(null);
  };

  const handleClearAll = () => {
    setSelectedImages([]);
    setUploadStatus(null);
  };

  const handleUploadAll = async () => {
    if (selectedImages.length === 0) return;

    setIsUploading(true);
    setUploadStatus(null);

    try {
      let successCount = 0;

      for (const uri of selectedImages) {
        const filename = uri.split("/").pop() ?? `receipt_${Date.now()}.jpg`;

        const formData = new FormData();
        formData.append("file", {
          uri,
          name: filename,
          type: "image/jpeg",
        } as any);

        const response = await fetch(BACKEND_UPLOAD_URL, {
          method: "POST",
          headers: {
            "Content-Type": "multipart/form-data",
          },
          body: formData,
        });

        if (!response.ok) {
          console.warn(
            `Upload failed for ${filename} with status ${response.status}`
          );
          continue;
        }

        successCount += 1;
      }

      if (successCount === selectedImages.length) {
        setUploadStatus(`✅ Uploaded ${successCount} image(s) successfully!`);
        setSelectedImages([]);
      } else if (successCount === 0) {
        setUploadStatus("❌ All uploads failed. Check network/backend.");
      } else {
        setUploadStatus(
          `⚠️ Uploaded ${successCount} of ${selectedImages.length} image(s). Some failed.`
        );
      }
    } catch (error) {
      console.warn("Upload error:", error);
      setUploadStatus("❌ Upload failed. Check network/backend.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header with title + Sign out */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Receipt Scanner</Text>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {/* Camera area */}
      <View style={styles.cameraContainer}>
        {permission?.granted ? (
          <>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing={facing}
              mode="picture"
              flash={flash}
            />

            <View style={styles.cameraControls}>
              <TouchableOpacity
                style={styles.smallButton}
                onPress={handleToggleCamera}
              >
                <Text style={styles.smallButtonText}>Flip</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.captureButton}
                onPress={handleTakePicture}
              >
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.smallButton}
                onPress={handleToggleFlash}
              >
                <Text style={styles.smallButtonText}>
                  {flash === "off"
                    ? "Flash Off"
                    : flash === "on"
                    ? "Flash On"
                    : "Flash Auto"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.cameraPermissionContainer}>
            <Text style={styles.permissionText}>
              Camera permission is not granted.{"\n"}
              You can still upload images from your files.
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={requestPermission}
            >
              <Text style={styles.primaryButtonText}>Enable Camera</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Always-visible Files button */}
      <View style={styles.filesRow}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handlePickFromFiles}
        >
          {uploadStatus && (
            <Text style={styles.uploadStatus}>{uploadStatus}</Text>
          )}
          <Text style={styles.primaryButtonText}>Upload from Files</Text>
        </TouchableOpacity>
      </View>

      {/* Selected images + upload controls */}
      {selectedImages.length > 0 && (
        <View style={styles.bottomPanel}>
          <Text style={styles.selectedInfo}>
            {selectedImages.length} image
            {selectedImages.length > 1 ? "s" : ""} selected
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.thumbnailStrip}
          >
            {selectedImages.map((uri, index) => (
              <TouchableOpacity
                key={`${uri}-${index}`}
                onLongPress={() => handleRemoveAt(index)}
                style={styles.thumbnailWrapper}
              >
                <Image source={{ uri }} style={styles.thumbnail} />
                <Text style={styles.thumbnailHint}>Hold to remove</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.secondaryButton, styles.flexButton]}
              onPress={handleClearAll}
              disabled={isUploading}
            >
              <Text style={styles.secondaryButtonText}>Clear</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryButton, styles.flexButton]}
              onPress={handleUploadAll}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.primaryButtonText}>
                  Upload {selectedImages.length}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: "#000",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
  },
  signOutText: {
    color: "#9ca3af",
    fontSize: 12,
  },
  cameraContainer: {
    flex: 1,
    position: "relative",
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  cameraPermissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#000",
  },
  permissionText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  smallButton: {
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  smallButtonText: {
    color: "#fff",
    fontSize: 12,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff",
  },
  filesRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#020617",
    borderTopWidth: 1,
    borderTopColor: "#1f2933",
  },
  bottomPanel: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#1f2933",
    backgroundColor: "#020617",
  },
  selectedInfo: {
    color: "#e5e7eb",
    fontSize: 14,
    marginBottom: 8,
  },
  thumbnailStrip: {
    maxHeight: 110,
  },
  thumbnailWrapper: {
    marginRight: 8,
    alignItems: "center",
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: 12,
  },
  thumbnailHint: {
    color: "#9ca3af",
    fontSize: 10,
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: "row",
    marginTop: 12,
    columnGap: 12,
  } as any,
  flexButton: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderColor: "#6b7280",
    borderWidth: 1,
    backgroundColor: "#111827",
  },
  secondaryButtonText: {
    color: "#e5e7eb",
    fontSize: 16,
  },
  uploadStatus: {
    marginBottom: 4,
    fontSize: 14,
    color: "#e5e7eb",
    textAlign: "center",
  },
});
