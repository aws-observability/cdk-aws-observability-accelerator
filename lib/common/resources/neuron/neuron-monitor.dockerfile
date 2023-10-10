FROM public.ecr.aws/lts/ubuntu:20.04_stable
ARG DEBIAN_FRONTEND=noninteractive

ARG APT_REPO=https://apt.repos.neuron.amazonaws.com

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    ca-certificates \
    wget \
    gnupg2 \
    pciutils \
    python3 \
    python3-pip \
    python3-setuptools \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /tmp/tmp* \
    && apt-get clean

RUN echo "deb $APT_REPO focal main" > /etc/apt/sources.list.d/neuron.list \
    && wget -qO - $APT_REPO/GPG-PUB-KEY-AMAZON-AWS-NEURON.PUB | apt-key add - \
    && apt-get update -y \
    && apt-get install -y aws-neuronx-tools \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /tmp/tmp* \
    && apt-get clean \
    && pip3 install prometheus-client

ENV PATH="${PATH}:/opt/aws/neuron/bin"

RUN useradd neuron-user
USER neuron-user

CMD ["/bin/bash"]