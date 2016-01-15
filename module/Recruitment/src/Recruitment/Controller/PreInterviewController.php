<?php

/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

namespace Recruitment\Controller;

use Database\Service\EntityManagerService;
use DateTime;
use Exception;
use Recruitment\Entity\Address;
use Recruitment\Entity\Person;
use Recruitment\Entity\Relative;
use Recruitment\Form\CpfFilter;
use Recruitment\Form\CpfForm;
use Recruitment\Form\PreInterviewForm;
use RuntimeException;
use Zend\File\Transfer\Adapter\Http as HttpAdapter;
use Zend\Mvc\Controller\AbstractActionController;
use Zend\Session\Container;
use Zend\View\Model\JsonModel;
use Zend\View\Model\ViewModel;

/**
 * Description of PreInterviewController
 *
 * @author Márcio Dias <marciojr91@gmail.com>
 */
class PreInterviewController extends AbstractActionController
{

    const PRE_INTERVIEW_DIR = './data/pre-interview/';
    const PERSONAL_FILE_SUFFIX = '_personal.pdf';
    const INCOME_FILE_SUFFIX = '_income.pdf';
    const EXPENDURE_FILE_SUFFIX = '_expendure.pdf';

    use EntityManagerService;

    /**
     * @todo Verificar se a entrevista do candidato já foi feita, se sim, faz o bloqueio da pré-entrevista.
     * 
     * @return ViewModel
     */
    public function indexAction()
    {
        $request = $this->getRequest();
        $form = new CpfForm();

        if ($request->isPost()) {
            $data = $request->getPost();
            $form->setInputFilter(new CpfFilter());
            $form->setData($data);

            if ($form->isValid()) {
                $data = $form->getData();

                try {

                    $em = $this->getEntityManager();

                    $registration = $em->getRepository('Recruitment\Entity\Registration')
                        ->findOneByPersonCpf($data['person_cpf']);

                    if ($registration !== null) {
                        if ($registration->getRegistrationConvocationDate() instanceof DateTime) {

                            $studentContainer = new Container('pre_interview');
                            $studentContainer->offsetSet('regId', $registration->getRegistrationId());

                            return $this->redirect()->toRoute('recruitment/pre-interview',
                                    array(
                                    'action' => 'studentPreInterviewFiles'
                            ));
                        }

                        $message = 'Candidato não convocado';
                    } else {
                        $message = 'Candidato não encontrado.';
                    }
                } catch (Exception $ex) {
                    $message = 'Erro inesperado, não foi possível encontrar uma inscrição associada a este cpf.'
                        . $ex->getMessage();
                }
            } else {
                $message = '';
            }
        } else {
            $message = null;
        }

        return new ViewModel(array(
            'message' => $message,
            'form' => $form,
        ));
    }

    public function studentPreInterviewFilesAction()
    {
        $studentContainer = new Container('pre_interview');

        if (!$studentContainer->offsetExists('regId')) {
            return $this->redirect()->toRoute('recruitment/pre-interview', array('action' => 'index'));
        }

        $request = $this->getRequest();

        $files['personal'] = $files['income'] = $files['expendure'] = false;

        $prefix = self::PRE_INTERVIEW_DIR . $studentContainer->offsetGet('regId');

        $files['personal'] = file_exists($prefix . self::PERSONAL_FILE_SUFFIX);
        $files['income'] = file_exists($prefix . self::INCOME_FILE_SUFFIX);
        $files['expendure'] = file_exists($prefix . self::EXPENDURE_FILE_SUFFIX);

        $message = null;
        if ($request->isPost()) {
            if ($files['personal'] && $files['income'] && $files['expendure']) {
                $this->redirect()->toRoute('recruitment/pre-interview',
                    array(
                    'action' => 'studentPreInterviewForm'
                ));
            } else {
                $message = 'Para prosseguir, por favor, envie todos os arquivos.';
            }
        }

        return new ViewModel(array(
            'message' => $message,
            'files' => $files
        ));
    }

    /**
     * Formulário de pré-entrevista
     * 
     * Se a sessão de pré-entrevista não foi criada redireciona para o início da pré-entrevista (indexAction)
     * Se algum(uns) dos arquivos ainda não foi recebido redireciona para a segunda etapa da pré-entrevista 
     * (studentPreInterviewFilesAction)
     * 
     * Salva o endereço se necessário, responsável se necessário, endereço do responsável se necessário e pré-entrevista
     * 
     * @return ViewModel
     */
    public function studentPreInterviewFormAction()
    {
        $studentContainer = new Container('pre_interview');

        // id de inscrição não está na sessão redireciona para o início
        if (!$studentContainer->offsetExists('regId')) {
            return $this->redirect()->toRoute('recruitment/pre-interview',
                    array(
                    'action' => 'index',
            ));
        }
        $rid = $studentContainer->offsetGet('regId');

        // Se ao menos um documento não foi enviado redireciona para a página de documentos da pré-entrevista
        $prefix = self::PRE_INTERVIEW_DIR . $rid;

        $files['personal'] = file_exists($prefix . self::PERSONAL_FILE_SUFFIX);
        $files['income'] = file_exists($prefix . self::INCOME_FILE_SUFFIX);
        $files['expendure'] = file_exists($prefix . self::EXPENDURE_FILE_SUFFIX);

        if (!$files['personal'] || !$files['income'] || !$files['expendure']) {
            return $this->redirect()->toRoute('recruitment/pre-interview',
                    array(
                    'action' => 'studentPreInterviewFilesAction',
            ));
        }

        $request = $this->getRequest();

        try {

            $em = $this->getEntityManager();
            $registration = $em->getReference('Recruitment\Entity\Registration', $rid);

            // se o candidato já respondeu o formulário uma vez avisa que a pré-entrevista já foi cadastrada.
            if ($registration->getPreInterview() !== null) {

                $studentContainer->getManager()->getStorage()->clear('pre_interview');

                return new ViewModel(array(
                    'registration' => $registration,
                    'form' => null,
                    'message' => 'O formulário de pré-entrevista já foi enviado.',
                ));
            }

            $person = $registration->getPerson();

            $options = array(
                'person' => array(
                    'relative' => $person->isPersonUnderage(),
                    'address' => true,
                ),
            );

            $form = new PreInterviewForm($em, $options);
            $form->bind($registration);
            if ($request->isPost()) {
                $form->setData($request->getPost());
                if ($form->isValid()) {

                    // manage duplicates in address, and relatives
                    $this->adjustAddresses($person);
                    $em->merge($registration);
                    $em->flush();
//                    $studentContainer->getManager()->getStorage()->clear('pre_interview');

                    return new ViewModel(array(
                        'registration' => null,
                        'form' => null,
                        'message' => 'Pré-entrevista concluída com com sucesso.',
                    ));
                }
            }
        } catch (Exception $ex) {
            return new ViewModel(array(
                'registration' => null,
                'form' => null,
                'message' => 'Erro inesperado. Por favor, entre em contato com o administrador do sistema.',
                'message' => $ex->getMessage(),
            ));
        }

        return new ViewModel(array(
            'registration' => $registration,
            'form' => $form,
            'message' => '',
        ));
    }

    /**
     * Faz as verificações para evitar violações de restrição unique nos endereços
     * 
     * @param Person $person
     * @return void
     */
    protected function adjustAddresses(Person $person)
    {
        $em = $this->getEntityManager();
        $addresses = $person->getAddresses();
        foreach ($addresses as $address) {
            $addr = $em->getRepository('Recruitment\Entity\Address')->findOneBy(array(
                'addressState' => $address->getAddressState(),
                'addressCity' => $address->getAddressCity(),
                'addressNeighborhood' => $address->getAddressNeighborhood(),
                'addressStreet' => $address->getAddressStreet(),
                'addressNumber' => $address->getAddressNumber(),
                'addressComplement' => $address->getAddressComplement(),
            ));

            $addressId = $address->getAddressId();
//
            if ($addressId === null) {
                // endereço existe mas não existe um id associado
                if ($addr !== null) {
                    $person->removeAddress($address);
                    $person->addAddress($addr);
                }
            } else {
                if ($addr !== null) {
                    // Endereço é atualizado para um endereço já cadastrado no banco de dados.
                    if ($addressId != $addr->getAddressId()) {
                        $person->addAddress($addr);
                    }
                } else {
                    // endereço é atualiza para um novo endereço, não existente no banco de dados.
                    $nAddress = new Address();
                    $nAddress->setAddressPostalCode($address->getAddressPostalCode());
                    $nAddress->setAddressState($address->getAddressState());
                    $nAddress->setAddressCity($address->getAddressCity());
                    $nAddress->setAddressNeighborhood($address->getAddressNeighborhood());
                    $nAddress->setAddressStreet($address->getAddressStreet());
                    $nAddress->setAddressNumber($address->getAddressNumber());
                    $nAddress->setAddressComplement($address->getAddressComplement());
                    $person->addAddress($nAddress);
                }

                $person->removeAddress($address);
                $em->detach($address);
            }
        }
    }

    /**
     * Salva o responsável se necessário, endereço se necessário, faz a associação candidato ~ responsável se 
     * necessário ou executa atualização do parentesco
     * 
     * @param Person $person
     * @param type $data
     */
    public function insertOrUpdateRelative(Person $person, $data)
    {
        $em = $this->getEntityManager();

        $personRelative = $em->getRepository('Recruitment\Entity\Person')->findOneBy(array(
            'personCpf' => $data['person_cpf_relative'],
        ));

        $relative = null;
        if ($personRelative !== null) {
            $relative = $em->getRepository('Recruitment\Entity\Relative')->findOneBy(array(
                'person' => $person->getPersonId(),
                'relative' => $personRelative->getPersonId(),
            ));
        } else {
            $personRelative = new Person();
            $personRelative
                ->setPersonFirstName($data['person_firstname_relative'])
                ->setPersonLastName($data['person_lastname_relative'])
                ->setPersonGender($data['person_gender_relative'])
                ->setPersonBirthday(new \DateTime($data['person_birthday_relative']))
                ->setPersonCpf($data['person_cpf_relative'])
                ->setPersonRg($data['person_rg_relative'])
                ->setPersonPhone($data['person_phone_relative'])
                ->setPersonEmail($data['person_email_relative'])
                ->setPersonPhoto();

            $em->persist($personRelative);
        }

        if ($relative === null) {
            $relative = new Relative();
            $relative
                ->setPerson($person)
                ->setRelative($personRelative);
        }

        $relative->setRelativeRelationship($data['relative_relationship']);

        $this->insertOrUpdateAddress($personRelative,
            array(
            'postal_code' => $data['postal_code_relative'],
            'state' => $data['state_relative'],
            'city' => $data['city_relative'],
            'neighborhood' => $data['neighborhood_relative'],
            'street' => $data['street_relative'],
            'number' => $data['number_relative'],
            'complement' => $data['complement_relative'],
        ));

        $em->persist($relative);
    }

    /**
     * Recebe os arquivos de informações pessoais, despesas e renda.
     * 
     * @return JsonModel
     * @throws RuntimeException
     */
    public function studentFileUploadAction()
    {
        $request = $this->getRequest();

        if ($request->isPost()) {
            $studentContainer = new Container('pre_interview');
            if ($studentContainer->offsetExists('regId')) {
                $type = $this->params('file', false);

                try {

                    if (!$type) {
                        throw new RuntimeException('O arquivo enviado não é de um dos tipos especificados.');
                    }

                    $file = $request->getFiles()->$type;

                    if ($file === null) {
                        throw new RuntimeException('Nenhum arquivo enviado.');
                    }

                    $targetDir = self::PRE_INTERVIEW_DIR;

                    $filename = $studentContainer->offsetGet('regId');
                    switch ($type) {
                        case 'income':
                            $filename .= self::INCOME_FILE_SUFFIX;
                            break;
                        case 'expendure':
                            $filename .= self::EXPENDURE_FILE_SUFFIX;
                            break;
                        case 'personal':
                            $filename .= self::PERSONAL_FILE_SUFFIX;
                            break;
                    }

                    $targetFile = $targetDir . $filename;

                    $uploadAdapter = new HttpAdapter();

                    $uploadAdapter->addFilter('File\Rename',
                        array(
                        'target' => $targetFile,
                        'overwrite' => true
                    ));

                    $uploadAdapter->setDestination($targetDir);

                    if (!$uploadAdapter->receive($type)) {
                        throw new RuntimeException(implode('\n', $uploadAdapter->getMessages()));
                    }

                    return new JsonModel(array(
                        'message' => 'Arquivo salvo com sucesso.',
                        'file' => $file,
                        'target' => $targetFile
                    ));
                } catch (Exception $ex) {

                    if ($ex instanceof RuntimeException) {
                        $message = 'Erro: ' . $ex->getMessage();
                    } else {
                        $message = 'Erro inesperado. Entre em contato com o administrador do sistema. '
                            . $ex->getMessage();
                    }

                    return new JsonModel(array(
                        'message' => $message,
                    ));
                }
            }

            return new JsonModel(array(
                'message' => 'Sessão expirada. Por favor, retorne a página de inserção de cpf e tente novamente.',
            ));
        }

        return $this->redirect()->toRoute('recruitment/pre-interview', array(
                'index'
        ));
    }

    public function getUploadedFileAction()
    {
        $this->layout('empty/layout');
        $file = $this->params('file', false);
        $rid = $this->params('rid', false);

        if (!$rid) {
            $studentContainer = new Container('pre_interview');
            if ($studentContainer->offsetExists('regId')) {
                $rid = $studentContainer->offsetGet('regId');
            } else {
                return $this->redirect()->toRoute('authorization/index');
            }
        }

        if ($file) {

            $pdf = self::PRE_INTERVIEW_DIR . $rid;
            switch ($file) {
                case 'income':
                    $pdf .= self::INCOME_FILE_SUFFIX;
                    break;
                case 'expendure':
                    $pdf .= self::EXPENDURE_FILE_SUFFIX;
                    break;
                case 'personal':
                    $pdf .= self::PERSONAL_FILE_SUFFIX;
                    break;
            }

            if (file_exists($pdf) !== false) {
                $response = $this->getResponse();
                $response->getHeaders()->addHeaderLine('Content-Type', 'application/pdf');
                $editalContent = file_get_contents($pdf);
                $response->setStatusCode(200);
                $response->setContent($editalContent);
                return $response;
            }

            $message = 'Arquivo não encontrado.';
        } else {
            $message = 'Nenhum tipo de arquivo foi especificado.';
        }

        return new ViewModel(array(
            'message' => $message,
        ));
    }

}