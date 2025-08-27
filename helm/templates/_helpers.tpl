{{/*
Expand the name of the chart.
*/}}
{{- define "store-trigger.name" -}}
{{- default .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "store-trigger.fullname" -}}
{{- $name := default .Chart.Name }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "store-trigger.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "store-trigger.labels" -}}
helm.sh/chart: {{ include "store-trigger.chart" . }}
{{ include "store-trigger.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{ include "mc-labels-and-annotations.labels" . }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "store-trigger.selectorLabels" -}}
app.kubernetes.io/name: {{ include "store-trigger.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{ include "mc-labels-and-annotations.selectorLabels" . }}
{{- end }}

{{/*
Returns the cloud provider name from the chart's values if exists or from global, defaults to minikube
*/}}
{{- define "store-trigger.cloudProviderFlavor" -}}
{{- if .Values.cloudProvider.flavor }}
    {{- .Values.cloudProvider.flavor -}}
{{- else -}}
    {{- .Values.global.cloudProvider.flavor | default "minikube" -}}
{{- end -}}
{{- end -}}

{{/*
Returns the tag of the chart.
*/}}
{{- define "store-trigger.tag" -}}
{{- default (printf "v%s" .Chart.AppVersion) .Values.image.tag }}
{{- end }}

{{/*
Returns the cloud provider docker registry url from the chart's values if exists or from global
*/}}
{{- define "store-trigger.cloudProviderDockerRegistryUrl" -}}
{{- if .Values.cloudProvider.dockerRegistryUrl }}
    {{- printf "%s/" .Values.cloudProvider.dockerRegistryUrl -}}
{{- else -}}
    {{- printf "%s/" .Values.global.cloudProvider.dockerRegistryUrl -}}
{{- end -}}
{{- end -}}

{{/*
Returns the cloud provider image pull secret name from the chart's values if exists or from global
*/}}
{{- define "store-trigger.cloudProviderImagePullSecretName" -}}
{{- if .Values.cloudProvider.imagePullSecretName }}
    {{- .Values.cloudProvider.imagePullSecretName -}}
{{- else if .Values.global.cloudProvider.imagePullSecretName -}}
    {{- .Values.global.cloudProvider.imagePullSecretName -}}
{{- end -}}
{{- end -}}

{{- define "provider" -}}
{{- if .Values.provider }}
    {{- .Values.provider -}}
{{- else -}}
    {{- .Values.global.providers.source -}}
{{- end -}}
{{- end -}}